import type { BackofficeAdhesionPayment, BackofficeAdhesionStatus } from "@prisma/client"
import { readInstallmentLedger } from "@/lib/backoffice-adhesions/installment-ledger"
import type { AdhesionPixProvider, BackofficeAdhesionPaymentDTO } from "./IBackofficeAdhesionService"

export type PixPaymentInstructions = {
  brCode: string
  brCodeBase64: string
  expiresAt: string
}

/**
 * Convivência com o Asaas: adesão com parcelas do ledger ainda pendentes continua cobrada pelo
 * Asaas (o ledger guarda o asaasPaymentId de cada parcela). O Abacate atende adesões sem ledger
 * ou cujo ledger não tem parcela pendente do Asaas (pagas por fora).
 */
export function resolvePixProvider(adhesion: { installmentLedger: unknown }): AdhesionPixProvider {
  const hasPendingAsaasInstallment = readInstallmentLedger(adhesion.installmentLedger).some(
    (entry) => entry.paymentSource === "ASAAS" && entry.status === "pending"
  )
  return hasPendingAsaasInstallment ? "ASAAS" : "ABACATE_PAY"
}

export function parsePixPaymentInstructions(value: unknown): PixPaymentInstructions | null {
  if (!value || typeof value !== "object") return null
  const candidate = value as Record<string, unknown>
  if (
    typeof candidate.brCode !== "string" ||
    typeof candidate.brCodeBase64 !== "string" ||
    typeof candidate.expiresAt !== "string"
  ) {
    return null
  }
  return {
    brCode: candidate.brCode,
    brCodeBase64: candidate.brCodeBase64,
    expiresAt: candidate.expiresAt,
  }
}

export function toAdhesionPixView(
  adhesion: { id: string; status: BackofficeAdhesionStatus },
  payment: BackofficeAdhesionPayment
): BackofficeAdhesionPaymentDTO {
  const instructions = parsePixPaymentInstructions(payment.paymentInstructions)
  return {
    adhesionId: adhesion.id,
    paymentId: payment.providerExternalId,
    provider: "ABACATE_PAY",
    status: adhesion.status,
    billingType: "PIX",
    amount: payment.amountCents / 100,
    invoiceUrl: null,
    bankSlipUrl: null,
    ...(instructions
      ? {
          pix: {
            encodedImage: instructions.brCodeBase64,
            payload: instructions.brCode,
            expirationDate: instructions.expiresAt,
          },
        }
      : {}),
  }
}
