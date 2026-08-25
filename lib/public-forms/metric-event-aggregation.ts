/**
 * Identidade de pergunta e agregação de eventos de métrica.
 *
 * As funções `*InMemory` são o **caminho antigo**: carregavam todas as linhas do
 * período e deduplicavam em JS. Elas continuam aqui como referência executável
 * da caracterização — o teste de integração roda as duas implementações contra a
 * mesma base e exige resultado idêntico antes de a agregação sair do JS para o
 * Postgres. Produção usa a versão SQL do repositório.
 */

/** Separador dos componentes de chave. Fora do domínio de título/mappingKey. */
const KEY_SEPARATOR = "|"

export type MetricEventRow = {
  eventType: string
  publicationId: string
  questionId: string | null
  questionSnapshot?: unknown
  visitorSessionId: string
}

export type GroupedMetricEvent = {
  eventType: string
  publicationId: string
  questionId: string | null
  questionKey: string | null
  /** Sessões únicas — nunca eventos brutos. */
  uniqueSessions: number
  /** @deprecated Alias de `uniqueSessions`; sai quando a UI do funil migrar. */
  _count: { _all: number }
}

/**
 * Identidade estável de pergunta, imune a deleção/recriação no builder.
 *
 * A FK `questionId` é `SetNull`: uma pergunta apagada e recriada leva um id novo,
 * e os eventos antigos ficam órfãos — no caso "Lista Fria" (24/08) perguntas com
 * 11 respostas persistidas apareciam como "0/0, 152 não exibidas". O snapshot
 * gravado junto do evento sobrevive à deleção, então é dele que sai a identidade:
 * `mappingKey` quando existe (é o contrato de negócio da pergunta) e, na falta,
 * título + posição.
 */
export function resolveQuestionIdentityKey(row: {
  questionId: string | null
  questionSnapshot?: unknown
}): string | null {
  const snapshot =
    row.questionSnapshot &&
    typeof row.questionSnapshot === "object" &&
    !Array.isArray(row.questionSnapshot)
      ? (row.questionSnapshot as Record<string, unknown>)
      : null

  const title = typeof snapshot?.title === "string" ? snapshot.title.trim() : ""
  const position =
    typeof snapshot?.position === "number" && Number.isFinite(snapshot.position)
      ? String(snapshot.position)
      : ""

  // `mappingKey` sozinho não identifica a pergunta: nem a validação de rascunho
  // nem o schema impedem duas perguntas da mesma publicação de compartilharem a
  // chave, e aí os eventos das duas cairiam no mesmo balde — uma exibiria a soma
  // e a outra 0/0, exatamente o sintoma que este agrupamento existe para matar.
  // O título desempata; escolhido em vez da posição porque é o que sobrevive ao
  // caso-alvo: a pergunta deletada e recriada volta com o mesmo título e em
  // outra posição (o builder reindexa a cada save). O custo é que renomear parte
  // o histórico em dois — visível, e menos grave que somar perguntas distintas.
  const mappingKey = typeof snapshot?.mappingKey === "string" ? snapshot.mappingKey.trim() : ""
  if (mappingKey) return `key:${mappingKey}${KEY_SEPARATOR}${title}`

  if (title) return `title:${title}${KEY_SEPARATOR}${position}`

  // Sem snapshot utilizável, o id vivo ainda serve — é o caso da maioria das
  // linhas, e é por isso que ele continua sendo o acelerador do agrupamento.
  return row.questionId ? `id:${row.questionId}` : null
}

export function groupMetricEventsInMemory(rows: MetricEventRow[]): GroupedMetricEvent[] {
  const buckets = new Map<
    string,
    {
      eventType: string
      publicationId: string
      questionId: string | null
      questionKey: string | null
      sessions: Set<string>
    }
  >()

  for (const row of rows) {
    const questionKey = resolveQuestionIdentityKey(row)
    const key = [row.eventType, row.publicationId, questionKey ?? ""].join(KEY_SEPARATOR)
    const bucket = buckets.get(key) ?? {
      eventType: row.eventType,
      publicationId: row.publicationId,
      questionId: row.questionId,
      questionKey,
      sessions: new Set<string>(),
    }
    // Pergunta recriada: linhas do mesmo `questionKey` podem ter `questionId`
    // NULL e não-NULL. O id vivo é o mais útil para o consumidor, então vence.
    if (!bucket.questionId && row.questionId) bucket.questionId = row.questionId
    bucket.sessions.add(row.visitorSessionId)
    buckets.set(key, bucket)
  }

  return Array.from(buckets.values()).map((bucket) => ({
    eventType: bucket.eventType,
    publicationId: bucket.publicationId,
    questionId: bucket.questionId,
    questionKey: bucket.questionKey,
    uniqueSessions: bucket.sessions.size,
    _count: { _all: bucket.sessions.size },
  }))
}

export function countDistinctSessionsByEventTypeInMemory(
  rows: Array<{ eventType: string; visitorSessionId: string }>
): Record<string, number> {
  const byType = new Map<string, Set<string>>()
  for (const row of rows) {
    const sessions = byType.get(row.eventType) ?? new Set<string>()
    sessions.add(row.visitorSessionId)
    byType.set(row.eventType, sessions)
  }
  return Object.fromEntries(
    Array.from(byType, ([eventType, sessions]) => [eventType, sessions.size])
  )
}

export function sortGroupedMetricEvents(rows: GroupedMetricEvent[]): GroupedMetricEvent[] {
  return [...rows].sort((a, b) =>
    [a.eventType, a.publicationId, a.questionKey ?? ""]
      .join(KEY_SEPARATOR)
      .localeCompare([b.eventType, b.publicationId, b.questionKey ?? ""].join(KEY_SEPARATOR))
  )
}
