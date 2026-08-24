export type CampaignDispatchProgressStatus = "sending" | "completed" | "failed"

export type CampaignDispatchCompletionKind = "pending" | "full" | "partial" | "failed"

export type CampaignDispatchProgress = {
  dispatchId: string
  dispatchNumber: number
  status: CampaignDispatchProgressStatus
  completionKind: CampaignDispatchCompletionKind
  totalRecipients: number
  acceptedCount: number
  failedCount: number
  queuedCount: number
  retryFailedOnly: boolean
  errorMessage: string | null
  updatedAt: string
}

export type CampaignDispatchProgressSummary = {
  activeDispatchCount: number
  terminalDispatchCount: number
  totalRecipients: number
  acceptedCount: number
  failedCount: number
  queuedCount: number
  completionKind: CampaignDispatchCompletionKind
  updatedAt: string
}

export type DispatchLogCounters = {
  acceptedCount: number
  failedCount: number
  queuedCount: number
  /**
   * Recusados pela nossa pré-validação, antes de tocar o provedor. Terminais e
   * NÃO retentáveis — reenviar submete o mesmo endereço à mesma regra
   * determinística. Contam para fechar a campanha, mas nunca para `totalSent`.
   */
  suppressedCount: number
}

export type DispatchProgressSource = {
  id: string
  dispatchNumber: number
  status: CampaignDispatchProgressStatus
  totalRecipients: number
  retryFailedOnly: boolean
  errorMessage: string | null
  updatedAt: Date | string
}

/** Zero em todos os tiers — usado como default antes de agregar. */
export function emptyDispatchLogCounters(): DispatchLogCounters {
  return { acceptedCount: 0, failedCount: 0, queuedCount: 0, suppressedCount: 0 }
}

/** Aceite pelo provedor: monotônico; não usa status=`sent`. */
export function isDispatchLogAccepted(log: {
  sentAt?: Date | string | null
  resendEmailId?: string | null
}): boolean {
  return log.sentAt != null || Boolean(log.resendEmailId)
}

export function aggregateDispatchLogCounters(
  logs: Array<{
    status: string
    sentAt?: Date | string | null
    resendEmailId?: string | null
  }>
): DispatchLogCounters {
  let acceptedCount = 0
  let failedCount = 0
  let queuedCount = 0
  let suppressedCount = 0

  for (const log of logs) {
    if (isDispatchLogAccepted(log)) {
      acceptedCount += 1
      continue
    }
    if (log.status === "failed") {
      failedCount += 1
      continue
    }
    if (log.status === "suppressed") {
      suppressedCount += 1
      continue
    }
    if (log.status === "queued") {
      queuedCount += 1
    }
  }

  return { acceptedCount, failedCount, queuedCount, suppressedCount }
}

type CumulativeLogTier = "queued" | "suppressed" | "failed" | "accepted"

/**
 * `suppressed` acima de `queued` (é terminal) e abaixo de `failed` (falha é
 * retentável e precisa continuar visível para o botão de reenvio).
 */
const CUMULATIVE_TIER_RANK: Record<CumulativeLogTier, number> = {
  queued: 0,
  suppressed: 1,
  failed: 2,
  accepted: 3,
}

/**
 * Agrega logs de **todos** os dispatches de uma campanha, deduplicando por
 * `recipientEmail` normalizado. Precedência: accepted > failed > queued —
 * aceite é monotônico; retry bem-sucedido sobrepõe falha anterior do mesmo endereço.
 */
export function aggregateCumulativeDispatchLogCounters(
  logs: Array<{
    recipientEmail: string
    status: string
    sentAt?: Date | string | null
    resendEmailId?: string | null
  }>
): DispatchLogCounters {
  const byEmail = new Map<string, CumulativeLogTier>()

  for (const log of logs) {
    const email = log.recipientEmail.trim().toLowerCase()
    if (!email) continue

    let tier: CumulativeLogTier | null = null
    if (isDispatchLogAccepted(log)) {
      tier = "accepted"
    } else if (log.status === "failed") {
      tier = "failed"
    } else if (log.status === "suppressed") {
      tier = "suppressed"
    } else if (log.status === "queued") {
      tier = "queued"
    }
    if (!tier) continue

    const previous = byEmail.get(email)
    if (!previous || CUMULATIVE_TIER_RANK[tier] > CUMULATIVE_TIER_RANK[previous]) {
      byEmail.set(email, tier)
    }
  }

  let acceptedCount = 0
  let failedCount = 0
  let queuedCount = 0
  let suppressedCount = 0
  for (const tier of byEmail.values()) {
    if (tier === "accepted") acceptedCount += 1
    else if (tier === "failed") failedCount += 1
    else if (tier === "suppressed") suppressedCount += 1
    else queuedCount += 1
  }

  return { acceptedCount, failedCount, queuedCount, suppressedCount }
}

/**
 * Monta uma entrada de progresso por campanha-folha a partir dos contadores
 * cumulativos + dispatch ativo/último (só para status/metadados).
 */
export function buildCumulativeCampaignDispatchProgress(params: {
  campaignId: string
  totalRecipients: number
  activeDispatch: CampaignDispatchProgress | null
  latestDispatch: CampaignDispatchProgress | null
  counters: DispatchLogCounters
}): CampaignDispatchProgress {
  const { campaignId, totalRecipients, activeDispatch, latestDispatch, counters } = params

  if (activeDispatch) {
    return {
      ...activeDispatch,
      totalRecipients: Math.max(totalRecipients, activeDispatch.totalRecipients),
      acceptedCount: counters.acceptedCount,
      failedCount: counters.failedCount,
      queuedCount: counters.queuedCount,
      completionKind: "pending",
    }
  }

  const base = latestDispatch
  const status: CampaignDispatchProgressStatus = base?.status ?? "completed"
  return {
    dispatchId: base?.dispatchId ?? `cumulative:${campaignId}`,
    dispatchNumber: base?.dispatchNumber ?? 0,
    status,
    completionKind: deriveDispatchCompletionKind({
      status,
      totalRecipients,
      acceptedCount: counters.acceptedCount,
      failedCount: counters.failedCount,
    }),
    totalRecipients,
    acceptedCount: counters.acceptedCount,
    failedCount: counters.failedCount,
    queuedCount: counters.queuedCount,
    retryFailedOnly: base?.retryFailedOnly ?? false,
    errorMessage: base?.errorMessage ?? null,
    updatedAt: base?.updatedAt ?? new Date(0).toISOString(),
  }
}

export function deriveDispatchCompletionKind(params: {
  status: CampaignDispatchProgressStatus
  totalRecipients: number
  acceptedCount: number
  failedCount: number
}): CampaignDispatchCompletionKind {
  if (params.status === "sending") return "pending"

  if (params.status === "failed" && params.acceptedCount === 0) {
    return "failed"
  }

  if (
    params.acceptedCount > 0 &&
    (params.failedCount > 0 || params.acceptedCount < params.totalRecipients)
  ) {
    return "partial"
  }

  if (params.status === "completed" && params.acceptedCount >= params.totalRecipients) {
    return "full"
  }

  if (params.status === "completed") {
    return params.acceptedCount > 0 && params.acceptedCount < params.totalRecipients
      ? "partial"
      : params.acceptedCount === 0
        ? "failed"
        : "full"
  }

  // status=failed mas todos os destinatários foram aceitos (ex.: reconciliado
  // via webhook após o registro interno já ter marcado falha) → sucesso total.
  if (params.acceptedCount >= params.totalRecipients && params.totalRecipients > 0) {
    return "full"
  }

  // status=failed com algum aceite → parcial
  return params.acceptedCount > 0 ? "partial" : "failed"
}

export function buildCampaignDispatchProgress(
  dispatch: DispatchProgressSource,
  counters: DispatchLogCounters
): CampaignDispatchProgress {
  const updatedAt =
    typeof dispatch.updatedAt === "string"
      ? dispatch.updatedAt
      : dispatch.updatedAt.toISOString()

  return {
    dispatchId: dispatch.id,
    dispatchNumber: dispatch.dispatchNumber,
    status: dispatch.status,
    completionKind: deriveDispatchCompletionKind({
      status: dispatch.status,
      totalRecipients: dispatch.totalRecipients,
      acceptedCount: counters.acceptedCount,
      failedCount: counters.failedCount,
    }),
    totalRecipients: dispatch.totalRecipients,
    acceptedCount: counters.acceptedCount,
    failedCount: counters.failedCount,
    queuedCount: counters.queuedCount,
    retryFailedOnly: dispatch.retryFailedOnly,
    errorMessage: dispatch.errorMessage,
    updatedAt,
  }
}

export function buildCampaignDispatchProgressSummary(
  progresses: CampaignDispatchProgress[]
): CampaignDispatchProgressSummary | null {
  if (progresses.length === 0) return null

  const active = progresses.filter((p) => p.status === "sending")
  const terminal = progresses.filter((p) => p.status !== "sending")

  const totalRecipients = progresses.reduce((sum, p) => sum + p.totalRecipients, 0)
  const acceptedCount = progresses.reduce((sum, p) => sum + p.acceptedCount, 0)
  const failedCount = progresses.reduce((sum, p) => sum + p.failedCount, 0)
  const queuedCount = progresses.reduce((sum, p) => sum + p.queuedCount, 0)

  let completionKind: CampaignDispatchCompletionKind = "pending"
  if (active.length > 0) {
    completionKind = "pending"
  } else if (acceptedCount === 0 && failedCount > 0) {
    completionKind = "failed"
  } else if (
    acceptedCount > 0 &&
    (failedCount > 0 || acceptedCount < totalRecipients || terminal.some((p) => p.completionKind === "partial"))
  ) {
    completionKind = "partial"
  } else if (acceptedCount >= totalRecipients && totalRecipients > 0) {
    completionKind = "full"
  } else if (terminal.every((p) => p.completionKind === "full")) {
    completionKind = "full"
  } else {
    completionKind = "failed"
  }

  const latestUpdatedAt = progresses
    .map((p) => p.updatedAt)
    .sort()
    .at(-1)!

  return {
    activeDispatchCount: active.length,
    terminalDispatchCount: terminal.length,
    totalRecipients,
    acceptedCount,
    failedCount,
    queuedCount,
    completionKind,
    updatedAt: latestUpdatedAt,
  }
}

export function formatCampaignDispatchProgressLabel(
  progress: Pick<
    CampaignDispatchProgress,
    | "status"
    | "completionKind"
    | "acceptedCount"
    | "totalRecipients"
    | "retryFailedOnly"
    | "errorMessage"
  > | null | undefined,
  options?: { summary?: boolean }
): string | null {
  if (!progress) return null

  const { acceptedCount, totalRecipients, retryFailedOnly, completionKind, status, errorMessage } =
    progress

  if (status === "sending") {
    if (acceptedCount === 0 && totalRecipients > 0) {
      return retryFailedOnly ? `Reenviando falhas 0/${totalRecipients}` : "Preparando envio"
    }
    if (retryFailedOnly) {
      return `Reenviando falhas ${acceptedCount}/${totalRecipients}`
    }
    return `Enviando ${acceptedCount}/${totalRecipients}`
  }

  if (completionKind === "full") {
    return options?.summary ? `Enviado ${acceptedCount}/${totalRecipients}` : "Enviado"
  }

  if (completionKind === "partial") {
    return `Parcialmente enviado ${acceptedCount}/${totalRecipients}`
  }

  if (completionKind === "failed") {
    const shortError = errorMessage?.trim()
    return shortError ? `Falhou — ${shortError}` : "Falhou"
  }

  return null
}
