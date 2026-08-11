/**
 * Shape mínimo do snapshot de campanha em envio. Mantido local para evitar
 * import circular com CampaignDispatchRealtimeContext.
 */
export type LeavingSendingCampaign = {
  id: string
  name: string
  totalRecipients: number
  totalSent: number
  acceptedCount?: number
  failedCount?: number
  completionKind?: string
  dispatchId?: string | null
  retryFailedOnly?: boolean
  errorMessage?: string | null
  status?: "sending" | "completed" | "failed"
}

/**
 * Lê o snapshot de saída do Map síncrono **antes** de enfileirar setState.
 * Evita a corrida em que `leavingSnapshot` era atribuído dentro do updater do
 * React e lido imediatamente depois (sem garantia de execução síncrona).
 */
export function takeLeavingSendingSnapshot<T extends LeavingSendingCampaign>(
  previousSending: Map<string, T>,
  campaignId: string,
  patch: { name?: string; errorMessage?: string | null }
): T | null {
  const previousEntry = previousSending.get(campaignId)
  if (!previousEntry) return null

  previousSending.delete(campaignId)

  return {
    ...previousEntry,
    name: patch.name || previousEntry.name,
    errorMessage: patch.errorMessage ?? previousEntry.errorMessage ?? null,
  }
}
