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

export function buildMetricEventWhereSql(filter: MetricEventAggregationFilter): Prisma.Sql {
  const conditions: Prisma.Sql[] = [Prisma.sql`"formId" = ${filter.formId}::uuid`]

  if (filter.publicationId) {
    conditions.push(Prisma.sql`"publicationId" = ${filter.publicationId}::uuid`)
  }
  if (filter.from) {
    conditions.push(Prisma.sql`"createdAt" >= ${filter.from}`)
  }
  if (filter.to) {
    conditions.push(Prisma.sql`"createdAt" <= ${filter.to}`)
  }

  return Prisma.join(conditions, " AND ")
}
