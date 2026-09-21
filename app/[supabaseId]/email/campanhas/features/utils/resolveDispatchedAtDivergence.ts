/**
 * Descolamento entre agendamento e envio real (todo 9c, caso Rafael 10/09):
 * a parte 3 foi agendada 07/09 10:00 e saiu só 08/09 00:00 por starvation do
 * teto diário. A UI que só mostra "Agendamento" esconde esse descolamento —
 * este util decide quando destacar visualmente a coluna "Disparado em".
 */
const LATE_DISPATCH_THRESHOLD_MS = 60 * 60 * 1000 // 1h

export function isDispatchedLate(
  scheduledAt: Date | string | null,
  sentAt: Date | string | null
): boolean {
  if (!scheduledAt || !sentAt) return false
  const scheduledMs = new Date(scheduledAt).getTime()
  const sentMs = new Date(sentAt).getTime()
  if (Number.isNaN(scheduledMs) || Number.isNaN(sentMs)) return false
  return sentMs - scheduledMs > LATE_DISPATCH_THRESHOLD_MS
}
