import type { AsaasAccountId } from "@/lib/asaas"
import type { PaymentProviderEnvironment } from "@/lib/payment-provider/types"
import { paymentMethodFromFingerprint } from "@/lib/payment-provider/attempt-method"
import { Output } from "@/lib/output"
import {
  buildPendingActionInvoiceId,
  parsePendingActionInvoiceId,
} from "@/app/api/shared/billing/invoiceClassification"
import { parseAdhesionExternalInvoiceId } from "@/lib/backoffice-adhesions/installment-ledger"
import type { BackofficeAdhesionInvoiceSource } from "@/app/api/infra/data/repositories/backoffice/backofficeAdhesion/IBackofficeAdhesionRepository"
import type {
  BackofficeAuditActor,
  BackofficeExternalPaymentInput,
} from "./IBackofficePlatformUsersUseCase"
import type { ExternalPaymentMetadata } from "@/app/api/useCases/pendingActions/PendingActionUseCase"

const CHARGED_STATUSES = new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"])

export interface ExternalPaymentAsaasItem {
  id: string
  status?: string
  deleted?: boolean
  externalReference?: string
}

export interface ExternalPaymentUseCaseDeps {
  findMasterById: (masterProfileId: string) => Promise<{
    id: string
    email: string
    asaasCustomerId: string | null
    asaasCustomerAccount: AsaasAccountId
  } | null>
  findAdhesionsByProfileId: (masterProfileId: string) => Promise<BackofficeAdhesionInvoiceSource[]>
  findPendingActionById: (id: string) => Promise<{
    id: string
    masterId: string
    actionType: string
    status: string
    paymentId: string | null
    asaasAccount: AsaasAccountId | null
    provider: string | null
    providerAttemptId: string | null
    payload: unknown
  } | null>
  findPendingActionByPaymentId: (paymentId: string) => Promise<{
    id: string
    masterId: string
    actionType: string
    status: string
    paymentId: string | null
    asaasAccount: AsaasAccountId | null
    provider: string | null
    providerAttemptId: string | null
    payload: unknown
  } | null>
  findProviderAttemptById: (attemptId: string) => Promise<{
    id: string
    ownerType: string
    ownerId: string
    provider: string
    environment: PaymentProviderEnvironment
    externalAccountContext: string
    externalId: string | null
    requestFingerprint: string
    status: string
  } | null>
  queryProviderStatus: (input: {
    provider: string
    environment: PaymentProviderEnvironment
    externalAccountContext: string
    externalId: string
    method: "PIX" | "CARD"
  }) => Promise<{ status: string }>
  cancelAsaasPayment: (
    paymentId: string,
    account: AsaasAccountId
  ) => Promise<{ ok: true } | { ok: false; error: string }>
  clearPendingActionPaymentId: (pendingActionId: string) => Promise<void>
  findAsaasPaymentAcrossAccounts: (
    paymentId: string,
    accounts: Array<{ account: AsaasAccountId; customerId: string }>
  ) => Promise<{ account: AsaasAccountId; payment: ExternalPaymentAsaasItem } | null>
  resolveKnownAsaasAccounts: (
    profile: { asaasCustomerId: string | null; asaasCustomerAccount: AsaasAccountId },
    adhesions: BackofficeAdhesionInvoiceSource[]
  ) => Array<{ account: AsaasAccountId; customerId: string }>
  guardLegacyInvoiceWrite: (account: AsaasAccountId) => Output | null
  applyExternalPayment: (
    pendingActionId: string,
    externalPayment: ExternalPaymentMetadata
  ) => Promise<Output>
  now?: () => Date
}

function isValidExternalProofUrl(value: string): boolean {
  try {
    const parsed = new URL(value)
    return parsed.protocol === "http:" || parsed.protocol === "https:"
  } catch {
    return false
  }
}

export async function executeMarkMasterUserInvoicePaidExternally(
  masterProfileId: string,
  invoiceId: string,
  input: BackofficeExternalPaymentInput,
  actor: BackofficeAuditActor,
  deps: ExternalPaymentUseCaseDeps
): Promise<Output> {
  if (!invoiceId || invoiceId.trim().length === 0) {
    return new Output(false, [], ["ID da fatura é obrigatório"], null)
  }

  const reference = typeof input.reference === "string" ? input.reference.trim() : ""
  if (!reference) {
    return new Output(false, [], ["Informe a referência do pagamento externo"], null)
  }

  const proofUrl =
    typeof input.proofUrl === "string" && input.proofUrl.trim() ? input.proofUrl.trim() : null
  if (proofUrl && !isValidExternalProofUrl(proofUrl)) {
    return new Output(
      false,
      [],
      ["Informe uma URL válida para o comprovante (http:// ou https://)"],
      null
    )
  }

  if (parseAdhesionExternalInvoiceId(invoiceId)) {
    return new Output(false, [], ["Esta fatura já está paga externamente"], null)
  }

  const master = await deps.findMasterById(masterProfileId)
  if (!master) {
    return new Output(false, [], ["Usuário master não encontrado"], null)
  }

  let targetAction: Awaited<ReturnType<ExternalPaymentUseCaseDeps["findPendingActionById"]>> = null
  let remoteAsaas: { paymentId: string; account: AsaasAccountId } | null = null

  const pendingActionId = parsePendingActionInvoiceId(invoiceId)
  if (pendingActionId) {
    const action = await deps.findPendingActionById(pendingActionId)
    if (!action || action.masterId !== masterProfileId) {
      return new Output(false, [], ["Fatura não encontrada"], null)
    }
    targetAction = action
  } else {
    const adhesions = await deps.findAdhesionsByProfileId(masterProfileId)
    const knownAccounts = deps.resolveKnownAsaasAccounts(master, adhesions)
    if (knownAccounts.length === 0) {
      return new Output(false, [], ["Fatura não encontrada"], null)
    }

    const found = await deps.findAsaasPaymentAcrossAccounts(invoiceId, knownAccounts)
    if (!found) {
      return new Output(false, [], ["Fatura não encontrada"], null)
    }

    const { payment, account } = found
    if (payment.deleted) {
      return new Output(false, [], ["Esta cobrança foi removida"], null)
    }

    if (CHARGED_STATUSES.has(String(payment.status ?? ""))) {
      return new Output(false, [], ["Esta fatura já está paga"], null)
    }

    const fromExternal = parsePendingActionInvoiceId(payment.externalReference ?? "")
    const linked = fromExternal
      ? await deps.findPendingActionById(fromExternal)
      : payment.id
        ? await deps.findPendingActionByPaymentId(payment.id)
        : null

    if (!linked || linked.masterId !== masterProfileId) {
      return new Output(
        false,
        [],
        ["Baixa externa disponível apenas para faturas de ações pendentes"],
        null
      )
    }

    targetAction = linked
    remoteAsaas = { paymentId: payment.id, account }
  }

  if (targetAction.status === "applied") {
    return new Output(false, [], ["Esta fatura já foi paga ou aplicada"], null)
  }

  if (targetAction.status !== "pending") {
    return new Output(
      false,
      [],
      ["Apenas faturas pendentes podem ser marcadas como pagas externamente"],
      null
    )
  }

  if (targetAction.provider) {
    // Multi-provider (ex.: AbacatePay): não chama Asaas; só permite baixa externa quando não há cobrança aberta ou já paga no provedor.
    if (targetAction.providerAttemptId) {
      const attempt = await deps.findProviderAttemptById(targetAction.providerAttemptId)
      if (attempt?.status === "CONFIRMED") {
        return new Output(false, [], ["Esta fatura já está paga no provedor"], null)
      }
      if (attempt?.externalId) {
        let remote: { status: string }
        try {
          remote = await deps.queryProviderStatus({
            provider: attempt.provider,
            environment: attempt.environment,
            externalAccountContext: attempt.externalAccountContext,
            externalId: attempt.externalId,
            method: paymentMethodFromFingerprint(attempt.requestFingerprint) ?? "PIX",
          })
        } catch (queryError) {
          console.warn(
            "[BackofficePlatformUsersUseCase][markMasterUserInvoicePaidExternally] Falha ao consultar provedor antes da baixa externa:",
            queryError
          )
          return new Output(
            false,
            [],
            ["Não foi possível consultar a cobrança no provedor antes da baixa externa"],
            null
          )
        }

        if (remote.status === "CONFIRMED") {
          return new Output(false, [], ["Esta fatura já está paga no provedor"], null)
        }
        if (remote.status === "PENDING" || remote.status === "UNKNOWN") {
          return new Output(
            false,
            [],
            [
              "Há uma cobrança aberta no provedor que não pode ser cancelada automaticamente; aguarde o vencimento ou trate no provedor antes da baixa externa",
            ],
            null
          )
        }
      }
    }
  } else if (remoteAsaas || targetAction.paymentId) {
    const asaasPaymentId = remoteAsaas?.paymentId ?? targetAction.paymentId!
    const asaasAccount = remoteAsaas?.account ?? targetAction.asaasAccount ?? "primary"
    const legacyGate = deps.guardLegacyInvoiceWrite(asaasAccount)
    if (legacyGate) return legacyGate

    const cancelResult = await deps.cancelAsaasPayment(asaasPaymentId, asaasAccount)
    if (!cancelResult.ok) {
      return new Output(false, [], [cancelResult.error], null)
    }

    if (targetAction.paymentId) {
      await deps.clearPendingActionPaymentId(targetAction.id)
    }
  }

  const paidAtDate = input.paidAt ? new Date(input.paidAt) : (deps.now?.() ?? new Date())
  const paidAt = Number.isNaN(paidAtDate.getTime())
    ? (deps.now?.() ?? new Date()).toISOString()
    : paidAtDate.toISOString()

  const externalPayment: ExternalPaymentMetadata = {
    reference,
    proofUrl,
    operatorId: actor.profileId,
    paidAt,
  }

  const applyOutput = await deps.applyExternalPayment(targetAction.id, externalPayment)
  if (!applyOutput.isValid) {
    return applyOutput
  }

  console.info("[BackofficePlatformUsersUseCase][markMasterUserInvoicePaidExternally]", {
    actorProfileId: actor.profileId,
    actorBackofficeUserId: actor.backofficeUserId,
    actorEmail: actor.backofficeEmail,
    masterProfileId,
    invoiceId,
    pendingActionId: targetAction.id,
    provider: targetAction.provider ?? (remoteAsaas || targetAction.paymentId ? "asaas" : "none"),
    reference,
    hasProofUrl: Boolean(proofUrl),
    paidAt,
  })

  return new Output(true, ["Fatura marcada como paga externamente com sucesso"], [], {
    id: buildPendingActionInvoiceId(targetAction.id),
    pendingActionId: targetAction.id,
    externalPayment,
  })
}
