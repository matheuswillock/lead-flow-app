/**
 * Cópia de respostas de formulário público quando um lead é transferido entre times.
 *
 * Por que copiar em vez de só reexibir: RadarProfile/RadarEvent e o histórico de
 * formulários são escopados por time (`teamId`). Se apenas "reexibíssemos" a submission
 * original do time de origem, o time de destino nunca teria essa resposta associada ao
 * seu próprio Radar/CRM, e o time de origem perderia a submission do seu histórico caso
 * ela fosse movida em vez de copiada. Por isso o lead de origem mantém sua submission
 * intacta e o time de destino recebe uma cópia própria, sempre — não depende de o time
 * de destino já ter um formulário publicado com nome/tipo equivalente ao da origem.
 */

export const SYSTEM_LEAD_TRANSFER_FORM_KIND = "system_lead_transfer_copy"

export const SYSTEM_LEAD_TRANSFER_FORM_NAME = "Respostas importadas (transferência de lead)"

export const SYSTEM_LEAD_TRANSFER_FORM_DESCRIPTION =
  "Formulário interno usado para preservar respostas de leads transferidos de outro time. Não é exibido nem preenchido publicamente."

export function buildLeadTransferCopyRequestKey(sourceSubmissionId: string, targetTeamId: string): string {
  return `lead-transfer-copy:${sourceSubmissionId}:${targetTeamId}`
}

/**
 * Em A→B→A a submission raiz já vive no time A; o requestKey sintético
 * `lead-transfer-copy:<root>:A` não bate com a chave original — trate a raiz
 * como já presente quando o form dela pertence ao time destino.
 */
export function shouldSkipLeadTransferCopyForRootInTarget(params: {
  rootSubmissionTeamId: string | null | undefined
  targetTeamId: string
}): boolean {
  return params.rootSubmissionTeamId === params.targetTeamId
}

/** Idempotência em transferências encadeadas (B→A→B): sempre usa a submission raiz. */
export function resolveLeadTransferCopySourceSubmissionId(
  origin: unknown,
  submissionId: string,
): string {
  if (origin && typeof origin === "object" && !Array.isArray(origin)) {
    const copyMeta = (origin as Record<string, unknown>).leadTransferCopy
    if (copyMeta && typeof copyMeta === "object" && !Array.isArray(copyMeta)) {
      const rootId = (copyMeta as { sourceSubmissionId?: unknown }).sourceSubmissionId
      if (typeof rootId === "string" && rootId.length > 0) {
        return rootId
      }
    }
  }
  return submissionId
}

export type LeadTransferListSubmission = {
  id: string
  origin: unknown
  createdAt: Date
}

/**
 * Ao listar no time destino, scoped (cópia) e legacy (raiz) têm IDs diferentes.
 * Deduplica pela submission raiz e prefere as linhas de `preferred` (scoped).
 */
export function mergeLeadTransferListSubmissions<T extends LeadTransferListSubmission>(
  preferred: T[],
  legacy: T[],
): T[] {
  const byRootId = new Map<string, T>()

  for (const row of preferred) {
    const rootId = resolveLeadTransferCopySourceSubmissionId(row.origin, row.id)
    byRootId.set(rootId, row)
  }

  for (const row of legacy) {
    const rootId = resolveLeadTransferCopySourceSubmissionId(row.origin, row.id)
    if (!byRootId.has(rootId)) {
      byRootId.set(rootId, row)
    }
  }

  return Array.from(byRootId.values()).sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  )
}

export type LeadTransferCopyOriginParams = {
  sourceOrigin: unknown
  sourceSubmissionId: string
  sourceFormId: string
  sourceFormName: string
  sourceTeamId: string
  targetTeamId: string
  copiedAt: Date
}

export function buildLeadTransferCopyOrigin(
  params: LeadTransferCopyOriginParams,
): Record<string, unknown> {
  const base =
    params.sourceOrigin && typeof params.sourceOrigin === "object" && !Array.isArray(params.sourceOrigin)
      ? (params.sourceOrigin as Record<string, unknown>)
      : {}

  return {
    ...base,
    leadTransferCopy: {
      sourceSubmissionId: params.sourceSubmissionId,
      sourceFormId: params.sourceFormId,
      sourceFormName: params.sourceFormName,
      sourceTeamId: params.sourceTeamId,
      targetTeamId: params.targetTeamId,
      copiedAt: params.copiedAt.toISOString(),
    },
  }
}
