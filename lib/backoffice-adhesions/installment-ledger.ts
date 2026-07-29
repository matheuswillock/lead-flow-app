export type AdhesionInstallmentLedgerEntry = {
  index: number
  amount: number
  paymentSource: "EXTERNAL" | "ASAAS"
  status: "paid" | "pending"
  asaasPaymentId: string | null
  paidAt: string | null
}

const ADHESION_EXTERNAL_INVOICE_PREFIX = "adhesion-ledger:"

export function hasExternalActivation(ledger: unknown): boolean {
  return readInstallmentLedger(ledger).some(
    (entry) => entry.paymentSource === "EXTERNAL" && entry.status === "paid"
  )
}

export function isAdhesionAccountActivated(input: {
  createdProfileId?: string | null
  installmentLedger?: unknown
}): boolean {
  if (input.createdProfileId) return true
  return hasExternalActivation(input.installmentLedger)
}

export function buildAdhesionExternalInvoiceId(adhesionId: string, index: number): string {
  return `${ADHESION_EXTERNAL_INVOICE_PREFIX}${adhesionId}:${index}`
}

export function parseAdhesionExternalInvoiceId(
  invoiceId: string
): { adhesionId: string; index: number } | null {
  if (!invoiceId.startsWith(ADHESION_EXTERNAL_INVOICE_PREFIX)) return null
  const payload = invoiceId.slice(ADHESION_EXTERNAL_INVOICE_PREFIX.length)
  const separatorIndex = payload.lastIndexOf(":")
  if (separatorIndex <= 0) return null
  const adhesionId = payload.slice(0, separatorIndex)
  const index = Number(payload.slice(separatorIndex + 1))
  if (!adhesionId || !Number.isInteger(index) || index < 0) return null
  return { adhesionId, index }
}

export type AdhesionExternalInvoiceSource = {
  id: string
  productName?: string | null
  installmentLedger: unknown
  paidAt?: Date | string | null
  createdAt: Date | string
}

export type AdhesionExternalInvoiceRow = {
  id: string
  invoiceIdDisplay: string
  invoiceName: string
  invoiceKind: "subscription"
  source: "adhesion_external"
  status: string
  statusGroup: "paid"
  value: number
  dateCreated: string | null
  dueDate: string | null
  paymentDate: string | null
  description: string
  billingType: string
  invoiceUrl: null
  bankSlipUrl: null
  invoiceNumber: null
  checkoutUrl: null
  pendingActionId: null
  sortDate: number
}

export function buildExternalInvoiceRowsFromAdhesion(
  adhesion: AdhesionExternalInvoiceSource
): AdhesionExternalInvoiceRow[] {
  const ledger = readInstallmentLedger(adhesion.installmentLedger)
  const productLabel = adhesion.productName?.trim() || "Adesão"
  const fallbackPaidAt =
    adhesion.paidAt instanceof Date
      ? adhesion.paidAt.toISOString()
      : typeof adhesion.paidAt === "string"
        ? adhesion.paidAt
        : null
  const createdAt =
    adhesion.createdAt instanceof Date
      ? adhesion.createdAt.toISOString()
      : String(adhesion.createdAt)

  return ledger
    .filter((entry) => entry.paymentSource === "EXTERNAL" && entry.status === "paid")
    .map((entry) => {
      const paymentDate = entry.paidAt ?? fallbackPaidAt
      const paymentDateKey = paymentDate ? paymentDate.slice(0, 10) : createdAt.slice(0, 10)
      const sortDate = paymentDate ? new Date(paymentDate).getTime() : new Date(createdAt).getTime()

      return {
        id: buildAdhesionExternalInvoiceId(adhesion.id, entry.index),
        invoiceIdDisplay: buildAdhesionExternalInvoiceId(adhesion.id, entry.index),
        invoiceName: productLabel,
        invoiceKind: "subscription" as const,
        source: "adhesion_external" as const,
        status: "CONFIRMED",
        statusGroup: "paid" as const,
        value: entry.amount,
        dateCreated: paymentDateKey,
        dueDate: paymentDateKey,
        paymentDate,
        description: `Adesão ${productLabel} — Parcela ${entry.index + 1} (pago externamente)`,
        billingType: "EXTERNAL",
        invoiceUrl: null,
        bankSlipUrl: null,
        invoiceNumber: null,
        checkoutUrl: null,
        pendingActionId: null,
        sortDate: Number.isFinite(sortDate) ? sortDate : new Date(createdAt).getTime(),
      }
    })
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
