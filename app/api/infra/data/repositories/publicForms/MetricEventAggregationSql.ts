import { Prisma } from "@prisma/client"

/**
 * Fragmentos SQL da agregação de eventos de métrica.
 *
 * A dedupe por sessão saiu do JS: `groupMetricEvents` e
 * `countDistinctSessionsByEventType` carregavam todas as linhas do período para
 * contar `Set.size` — funcionava nos ~16 mil eventos de hoje e quebrava no
 * próximo 10×. O Postgres já sabe fazer `COUNT(DISTINCT …)`; o Prisma Client não
 * expressa isso, então aqui é SQL raw com os nomes físicos do `@@map`.
 */

export type MetricEventAggregationFilter = {
  formId: string
  publicationId?: string
  from?: Date
  to?: Date
}

/**
 * Espelho SQL de `resolveQuestionIdentityKey`. Os dois **precisam** concordar:
 * o teste de caracterização roda a versão JS contra a mesma base e compara.
 */
export const QUESTION_IDENTITY_KEY_SQL = Prisma.sql`
      CASE
        WHEN NULLIF(btrim(COALESCE("questionSnapshot"->>'mappingKey', '')), '') IS NOT NULL
          -- Titulo desempata: duas perguntas da mesma publicacao podem
          -- compartilhar o mesmo mappingKey (nada no schema ou na validacao
          -- impede) e sem isso os eventos das duas cairiam no mesmo balde.
          THEN 'key:' || btrim("questionSnapshot"->>'mappingKey') || '|' ||
               btrim(COALESCE("questionSnapshot"->>'title', ''))
        WHEN NULLIF(btrim(COALESCE("questionSnapshot"->>'title', '')), '') IS NOT NULL
          THEN 'title:' || btrim("questionSnapshot"->>'title') || '|' ||
               CASE
                 WHEN jsonb_typeof("questionSnapshot"->'position') = 'number'
                   THEN "questionSnapshot"->>'position'
                 ELSE ''
               END
        WHEN "questionId" IS NOT NULL THEN 'id:' || "questionId"::text
        ELSE NULL
      END`

/**
 * Relógio do período: o do fato, com o do insert como reserva.
 *
 * `createdAt` é quando a LINHA nasceu — no evento server-side, o momento em que a
 * fila drenou. Filtrar por ele mantinha o funil datando conversão pelo drain,
 * que é exatamente o incidente de 20–22/08: mais `form_completed` que
 * `form_viewed` no recorte de três dias. `occurredAt` carrega o aceite (gravado
 * no `processInBackground` e no backfill); o `COALESCE` cobre as linhas
 * históricas e os eventos de cliente que nunca tiveram o campo.
 */
const PERIOD_ANCHOR_SQL = Prisma.sql`COALESCE("occurredAt", "createdAt")`

/**
 * SPEC 40 E0 / todo 23 — as conclusões que o cron de despacho inventou ficam
 * fora de toda contagem de funil.
 *
 * Antes do E0 o dispatcher completava cascas do `/progress` como se fossem
 * envio: 311 submissões, de 30/07 a 25/08. O efeito é de medição, não de dado —
 * o painel mostrava 21,5% de conversão contra 75,7% reais. A marca é gravada
 * pela migration `20260825213332`; aqui ela some das séries.
 *
 * Predicado sobre `IS NULL`, não sobre `= false`: linha não marcada não tem a
 * chave, e `origin->'x' = 'false'` não casaria com ela. Casado com o índice
 * parcial da mesma migration.
 */
export const NOT_FABRICATED_BY_DISPATCHER_SQL = Prisma.sql`(origin -> 'fabricatedByDispatcher') IS NULL`

/**
 * Mesmo corte para quem lê pelo Prisma Client em vez de SQL cru
 * (`listFormConversionTotals`). Os dois **precisam** concordar: um funil que
 * exclui a fabricada e um ranking que a inclui dariam números diferentes para a
 * mesma pergunta, na mesma tela.
 *
 * Em JS, e não como `where` de JSON do Prisma, de propósito. O filtro que
 * queremos é "a chave **não existe**", e o `path`/`equals` do Prisma vira
 * comparação SQL sobre `origin#>'{...}'`: para linha sem a chave o operando é
 * NULL, `NOT (NULL = 'true')` é NULL, e a lógica de três valores **descarta a
 * linha** — o oposto do pretendido, silenciosamente. Aqui a consulta já
 * materializa as linhas para deduplicar por sessão, então filtrar em memória
 * não custa varredura extra e a semântica fica explícita e testável.
 */
export function isFabricatedByDispatcher(origin: unknown): boolean {
  if (!origin || typeof origin !== "object" || Array.isArray(origin)) return false
  return (origin as Record<string, unknown>).fabricatedByDispatcher === true
}

export function buildMetricEventWhereSql(filter: MetricEventAggregationFilter): Prisma.Sql {
  const conditions: Prisma.Sql[] = [
    Prisma.sql`"formId" = ${filter.formId}::uuid`,
    NOT_FABRICATED_BY_DISPATCHER_SQL,
  ]

  if (filter.publicationId) {
    conditions.push(Prisma.sql`"publicationId" = ${filter.publicationId}::uuid`)
  }
  if (filter.from) {
    conditions.push(Prisma.sql`${PERIOD_ANCHOR_SQL} >= ${filter.from}`)
  }
  if (filter.to) {
    conditions.push(Prisma.sql`${PERIOD_ANCHOR_SQL} <= ${filter.to}`)
  }

  return Prisma.join(conditions, " AND ")
}
