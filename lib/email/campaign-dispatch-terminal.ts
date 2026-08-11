import type {
  CampaignDispatchCompletionKind,
  CampaignDispatchProgress,
  CampaignDispatchProgressSummary,
} from "@/lib/email/campaign-dispatch-progress"

export type ResolvedDispatchTerminal = {
  completionKind: Exclude<CampaignDispatchCompletionKind, "pending">
  status: "completed" | "failed"
  acceptedCount: number
  failedCount: number
  totalRecipients: number
  errorMessage: string | null
  dispatchId: string | null
  retryFailedOnly: boolean
}

export type DispatchTerminalToast = {
  type: "success" | "warning" | "error"
  message: string
}

type CampaignTerminalSource = {
  status: string
  totalRecipients: number
  totalSent: number
  errorMessage?: string | null
  latestDispatch?: CampaignDispatchProgress | null
  activeDispatch?: CampaignDispatchProgress | null
  dispatchProgressSummary?: CampaignDispatchProgressSummary | null
}

function normalizeTerminalStatus(
  completionKind: Exclude<CampaignDispatchCompletionKind, "pending">
): "completed" | "failed" {
  return completionKind === "failed" ? "failed" : "completed"
}

/**
 * Resolve o estado terminal real do disparo a partir do contrato de progresso.
 * Retorna null enquanto ainda houver dispatch/campanha em `sending` — nunca inventa `full`.
 */
export function resolveCampaignDispatchTerminal(
  campaign: CampaignTerminalSource
): ResolvedDispatchTerminal | null {
  if (campaign.status === "sending" || campaign.activeDispatch?.status === "sending") {
    return null
  }

  const progress = campaign.latestDispatch
  if (progress && progress.status !== "sending" && progress.completionKind !== "pending") {
    return {
      completionKind: progress.completionKind,
      status: normalizeTerminalStatus(progress.completionKind),
      acceptedCount: progress.acceptedCount,
      failedCount: progress.failedCount,
      totalRecipients: progress.totalRecipients,
      errorMessage: progress.errorMessage ?? campaign.errorMessage ?? null,
      dispatchId: progress.dispatchId,
      retryFailedOnly: progress.retryFailedOnly,
    }
  }

  const summary = campaign.dispatchProgressSummary
  if (summary && summary.completionKind !== "pending") {
    return {
      completionKind: summary.completionKind,
      status: normalizeTerminalStatus(summary.completionKind),
      acceptedCount: summary.acceptedCount,
      failedCount: summary.failedCount,
      totalRecipients: summary.totalRecipients,
      errorMessage: campaign.errorMessage ?? null,
      dispatchId: progress?.dispatchId ?? null,
      retryFailedOnly: false,
    }
  }

  if (campaign.status === "failed") {
    const completionKind = campaign.totalSent > 0 ? "partial" : "failed"
    return {
      completionKind,
      status: normalizeTerminalStatus(completionKind),
      acceptedCount: campaign.totalSent,
      failedCount: Math.max(campaign.totalRecipients - campaign.totalSent, 0),
      totalRecipients: campaign.totalRecipients,
      errorMessage: campaign.errorMessage ?? null,
      dispatchId: progress?.dispatchId ?? null,
      retryFailedOnly: false,
    }
  }

  if (campaign.status === "partially_sent") {
    return {
      completionKind: "partial",
      status: "completed",
      acceptedCount: campaign.totalSent,
      failedCount: Math.max(campaign.totalRecipients - campaign.totalSent, 0),
      totalRecipients: campaign.totalRecipients,
      errorMessage: campaign.errorMessage ?? null,
      dispatchId: progress?.dispatchId ?? null,
      retryFailedOnly: false,
    }
  }

  if (campaign.status === "sent") {
    return {
      completionKind: "full",
      status: "completed",
      acceptedCount: campaign.totalSent,
      failedCount: 0,
      totalRecipients: campaign.totalRecipients,
      errorMessage: null,
      dispatchId: progress?.dispatchId ?? null,
      retryFailedOnly: false,
    }
  }

  return null
}

/**
 * Decide se o polling de retry deve emitir o toast terminal.
 *
 * `handleSend` seta `sendingId` **otimisticamente** antes do POST resolver, o que dispara
 * o polling. Se o retry morrer no gate (ex.: variáveis), nenhum `EmailCampaignDispatch` novo
 * é criado e a sub-campanha continua `failed` com o `errorMessage` **antigo** — o polling
 * emitiria um toast fantasma com o erro velho.
 *
 * Regra fail-closed: só é um estado terminal novo se um `dispatchId` foi observado e ele
 * **difere** do `dispatchId` pré-tentativa. Sem dispatch novo ⇒ sem toast (o `catch` do
 * `handleSend` cuida do erro real e atual).
 */
export function isNewTerminalDispatch(params: {
  observedDispatchId: string | null | undefined
  preAttemptDispatchId: string | null | undefined
}): boolean {
  const observed = params.observedDispatchId ?? null
  if (observed === null) return false
  return observed !== (params.preAttemptDispatchId ?? null)
}

export function buildDispatchTerminalToast(
  name: string | null | undefined,
  terminal: ResolvedDispatchTerminal
): DispatchTerminalToast {
  const named = Boolean(name?.trim())
  const quoted = named ? `"${name}"` : null

  if (terminal.completionKind === "failed") {
    if (terminal.errorMessage) {
      return {
        type: "error",
        message: quoted
          ? `Disparo de ${quoted} falhou: ${terminal.errorMessage}`
          : `Disparo falhou: ${terminal.errorMessage}`,
      }
    }
    return {
      type: "error",
      message: quoted ? `Disparo de ${quoted} falhou.` : "Disparo falhou.",
    }
  }

  if (terminal.completionKind === "partial") {
    const ratio = `${terminal.acceptedCount}/${terminal.totalRecipients}`
    return {
      type: "warning",
      message: quoted
        ? `Disparo de ${quoted} concluído parcialmente (${ratio}). O status foi atualizado automaticamente.`
        : `Disparo concluído parcialmente (${ratio}). O status foi atualizado automaticamente.`,
    }
  }

  return {
    type: "success",
    message: quoted
      ? `Disparo de ${quoted} concluído. O status foi atualizado automaticamente.`
      : "Disparo concluído. O status foi atualizado automaticamente.",
  }
}

export function applyDispatchTerminalToast(
  toastApi: {
    success: (message: string) => void
    warning: (message: string) => void
    error: (message: string) => void
  },
  toastPayload: DispatchTerminalToast
): void {
  if (toastPayload.type === "error") {
    toastApi.error(toastPayload.message)
    return
  }
  if (toastPayload.type === "warning") {
    toastApi.warning(toastPayload.message)
    return
  }
  toastApi.success(toastPayload.message)
}
