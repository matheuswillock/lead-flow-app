export type AdhesionInstallmentLedgerEntry = {
  index: number
  amount: number
  paymentSource: "EXTERNAL" | "ASAAS"
  status: "paid" | "pending"
  asaasPaymentId: string | null
  paidAt: string | null
}

export function readInstallmentLedger(value: unknown): AdhesionInstallmentLedgerEntry[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry, fallbackIndex) => {
    if (!entry || typeof entry !== "object") return []
    const record = entry as Record<string, unknown>
    const index =
      typeof record.index === "number" && Number.isFinite(record.index)
        ? Math.trunc(record.index)
        : fallbackIndex
    const amount = Number(record.amount)
    if (!Number.isFinite(amount)) return []
    const paymentSource = record.paymentSource === "EXTERNAL" ? "EXTERNAL" : "ASAAS"
    const status = record.status === "paid" ? "paid" : "pending"
    const asaasPaymentId =
      typeof record.asaasPaymentId === "string" && record.asaasPaymentId.trim()
        ? record.asaasPaymentId
        : null
    const paidAt =
      typeof record.paidAt === "string" && record.paidAt.trim() ? record.paidAt : null
    return [{ index, amount, paymentSource, status, asaasPaymentId, paidAt }]
  })
}

export function hasCustomInstallmentAmounts(ledger: AdhesionInstallmentLedgerEntry[]): boolean {
  if (ledger.length <= 1) return false
  const unique = new Set(ledger.map((entry) => entry.amount.toFixed(2)))
  return unique.size > 1
}
