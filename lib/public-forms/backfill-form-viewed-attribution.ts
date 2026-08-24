import {
  buildAttributionEventKeySuffix,
  buildPublicFormTrackEventKey,
} from "@/lib/public-forms/origin"

/**
 * Recuperação das linhas de `form_viewed` que perderam a atribuição de campanha.
 *
 * Contexto: até 2026-08-24 o `eventKey` do `form_viewed` era
 * `{session}:form_viewed:form`, e `session` vem de um cookie de 30 dias. Como o
 * `form_viewed` dispara em todo carregamento e o upsert de métrica é
 * first-write-wins (`update: {}`), qualquer visita anterior sem `cs_el` queimava
 * a chave: o clique vindo da campanha virava no-op e o `campaignId` nunca
 * entrava. `form_started`/`form_completed` escapavam porque exigem interação e
 * quase sempre nasciam já na visita da campanha.
 *
 * Resultado em produção: funil logicamente impossível — `form_viewed` 0 com
 * `form_started` 1.
 *
 * Estratégia: **não** mutar a linha órfã. Ela representa a visita direta e o
 * `createdAt` dela está fora da janela do disparo — corrigir só o `origin`
 * deixaria a linha invisível para o filtro de período do analytics do mesmo
 * jeito. Em vez disso, sintetizamos a linha da visita atribuída, com a chave
 * nova e os carimbos de tempo do evento doador.
 *
 * A inferência é sólida: não existe iniciar ou concluir um formulário sem
 * tê-lo visualizado. Ainda assim, cada linha criada leva
 * `origin.backfill = "form_viewed_attribution"` para ser auditável e
 * reversível.
 */

export const FORM_VIEWED_BACKFILL_MARKER = "form_viewed_attribution"

export type MetricEventRow = {
  eventKey: string
  eventType: string
  visitorSessionId: string
  formId: string
  publicationId: string
  occurredAt: Date | null
  createdAt: Date
  origin: unknown
}

export type SynthesizedFormViewedRow = {
  eventKey: string
  visitorSessionId: string
  formId: string
  publicationId: string
  origin: Record<string, unknown>
  occurredAt: Date | null
  createdAt: Date
  donorEventKey: string
  donorEventType: string
  emailLogId: string
}

export type FormViewedBackfillPlan = {
  rows: SynthesizedFormViewedRow[]
  /** Sessões com evento atribuído mas sem nenhum `form_viewed` — não sintetizamos. */
  sessionsWithoutOrphanView: string[]
  /** Sessões cuja linha atribuída já existe — nada a fazer. */
  sessionsAlreadyAttributed: string[]
}

/** Doadores mais próximos do view primeiro: quem inicia acabou de visualizar. */
const DONOR_PRIORITY = ["form_started", "form_completed", "lead_created", "lead_attached"]

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function readEmailLogId(origin: unknown): string | null {
  const record = asRecord(origin)
  const value = record?.emailLogId
  if (typeof value !== "string") return null
  // Sufixo vazio = não é UUID válido. Reaproveita a mesma validação da chave.
  return buildAttributionEventKeySuffix(value) ? value.trim() : null
}

function donorRank(eventType: string): number {
  const index = DONOR_PRIORITY.indexOf(eventType)
  return index === -1 ? DONOR_PRIORITY.length : index
}

/**
 * Monta o plano de sintetização a partir de todas as linhas de métrica das
 * sessões candidatas. Função pura: não toca no banco.
 *
 * Idempotente — se a linha atribuída já existir no conjunto recebido, a sessão
 * é reportada em `sessionsAlreadyAttributed` e nada é planejado.
 */
export function planFormViewedAttributionBackfill(
  rows: MetricEventRow[]
): FormViewedBackfillPlan {
  const bySession = new Map<string, MetricEventRow[]>()
  for (const row of rows) {
    const list = bySession.get(row.visitorSessionId)
    if (list) list.push(row)
    else bySession.set(row.visitorSessionId, [row])
  }

  const plan: FormViewedBackfillPlan = {
    rows: [],
    sessionsWithoutOrphanView: [],
    sessionsAlreadyAttributed: [],
  }

  for (const [visitorSessionId, sessionRows] of bySession) {
    const donors = sessionRows
      .map((row) => ({ row, emailLogId: readEmailLogId(row.origin) }))
      .filter((item): item is { row: MetricEventRow; emailLogId: string } =>
        Boolean(item.emailLogId)
      )
    if (donors.length === 0) continue

    const hasOrphanView = sessionRows.some(
      (row) => row.eventType === "form_viewed" && !readEmailLogId(row.origin)
    )

    // Um doador por emailLogId: duas campanhas para o mesmo destinatário geram
    // duas linhas de view, que é exatamente o que o funil por campanha precisa.
    const bestByEmailLog = new Map<string, { row: MetricEventRow; emailLogId: string }>()
    for (const donor of donors) {
      const current = bestByEmailLog.get(donor.emailLogId)
      if (!current || donorRank(donor.row.eventType) < donorRank(current.row.eventType)) {
        bestByEmailLog.set(donor.emailLogId, donor)
      }
    }

    for (const [emailLogId, donor] of bestByEmailLog) {
      const eventKey = buildPublicFormTrackEventKey({
        visitorSessionId,
        eventType: "form_viewed",
        emailLogId,
      })

      if (sessionRows.some((row) => row.eventKey === eventKey)) {
        plan.sessionsAlreadyAttributed.push(visitorSessionId)
        continue
      }
      if (!hasOrphanView) {
        plan.sessionsWithoutOrphanView.push(visitorSessionId)
        continue
      }

      const donorOrigin = asRecord(donor.row.origin) ?? {}
      plan.rows.push({
        eventKey,
        visitorSessionId,
        formId: donor.row.formId,
        publicationId: donor.row.publicationId,
        origin: { ...donorOrigin, backfill: FORM_VIEWED_BACKFILL_MARKER },
        // Carimbos do doador: a visualização aconteceu imediatamente antes da
        // interação, e é isso que põe a linha dentro da janela do disparo.
        occurredAt: donor.row.occurredAt,
        createdAt: donor.row.createdAt,
        donorEventKey: donor.row.eventKey,
        donorEventType: donor.row.eventType,
        emailLogId,
      })
    }
  }

  return plan
}
