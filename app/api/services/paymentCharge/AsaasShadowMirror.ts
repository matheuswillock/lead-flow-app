import type { IAsaasProfileLookupRepository } from "@/app/api/infra/data/repositories/paymentCharge/IAsaasProfileLookupRepository"
import { chargeStatusFromAsaas } from "@/lib/payments/charge-status"
import type { ChargePurpose } from "@/lib/payments/types"
import type { ChargeLedger } from "./ChargeLedger"

export type AsaasShadowPayment = {
  readonly id?: string
  readonly status?: string
  readonly value?: number
  readonly billingType?: string
  readonly dueDate?: string
  readonly customer?: string
  readonly subscription?: string
  readonly externalReference?: string
  readonly paymentDate?: string | null
  readonly confirmedDate?: string | null
  readonly clientPaymentDate?: string | null
}

export type AsaasShadowInput = {
  readonly account: "primary" | "legacy"
  readonly event: string
  readonly payment: AsaasShadowPayment
}

export type AsaasShadowMirrorDependencies = {
  readonly ledger: Pick<ChargeLedger, "record">
  readonly profiles: IAsaasProfileLookupRepository
  readonly environment: () => "DEV" | "PRODUCTION"
  readonly logError?: (message: string, context: Record<string, unknown>) => void
}

const PURPOSE_BY_REFERENCE_PREFIX: ReadonlyArray<readonly [string, ChargePurpose]> = [
  ["platform-purchase-", "PLATFORM_PURCHASE"],
  ["backoffice-adhesion-", "ADHESION"],
  ["public-adhesion-pix:", "ADHESION"],
  ["subscription-change-order-", "CHANGE_ORDER"],
  ["pending-action-", "ADD_USER"],
  ["pending-operator-", "ADD_USER"],
  ["billing-intent:", "ADD_USER"],
  ["manager-", "SUBSCRIPTION_RENEWAL"],
]

/**
 * Heurística: o Asaas não carrega a finalidade. É usada só para classificar o espelho; o job de
 * divergência compara valor, status e ausência, nunca a finalidade.
 */
export function inferAsaasChargePurpose(payment: {
  readonly externalReference?: string
  readonly subscription?: string
}): ChargePurpose {
  const reference = payment.externalReference ?? ""
  const match = PURPOSE_BY_REFERENCE_PREFIX.find(([prefix]) => reference.startsWith(prefix))
  if (match) return match[1]
  return payment.subscription ? "SUBSCRIPTION_RENEWAL" : "BACKOFFICE_CHARGE"
}

/**
 * Espelha eventos de pagamento do Asaas no ledger (decisão 14). Observabilidade pura: NUNCA lança
 * e nunca altera o efeito de domínio do webhook.
 */
export class AsaasShadowMirror {
  constructor(private readonly dependencies: AsaasShadowMirrorDependencies) {}

  async mirrorPayment(input: AsaasShadowInput): Promise<void> {
    try {
      await this.mirror(input)
    } catch (error) {
      this.logError("[AsaasShadowMirror] Error", input, error instanceof Error ? error.message : "unknown")
    }
  }

  private async mirror({ account, event, payment }: AsaasShadowInput): Promise<void> {
    if (!payment.id || typeof payment.value !== "number") return
    const owner = await this.dependencies.profiles.findProfileId({
      account,
      subscriptionId: payment.subscription,
      customerId: payment.customer,
    })
    if (!owner) {
      this.logError("[AsaasShadowMirror] Perfil não resolvido", { account, event, payment }, "profile_not_found")
      return
    }

    const deleted = event === "PAYMENT_DELETED"
    const rawStatus = deleted ? "DELETED" : (payment.status ?? null)
    await this.dependencies.ledger.record({
      profileId: owner.profileId,
      subscriptionId: owner.subscriptionId,
      purpose: inferAsaasChargePurpose(payment),
      purposeRefId: payment.externalReference ?? null,
      status: chargeStatusFromAsaas(rawStatus),
      rawStatus,
      amountCents: Math.round(payment.value * 100),
      method: payment.billingType ?? null,
      dueDate: payment.dueDate ? new Date(`${payment.dueDate}T00:00:00.000Z`) : null,
      paidAt: parseDate(payment.clientPaymentDate ?? payment.paymentDate ?? payment.confirmedDate),
      provider: "ASAAS",
      providerEnvironment: this.dependencies.environment(),
      providerContext: account,
      providerExternalId: payment.id,
      idempotencyKey: `asaas:${account}:${payment.id}`,
      source: "ASAAS_SHADOW",
      actor: event,
    })
  }

  private logError(message: string, input: unknown, reason: string): void {
    const log = this.dependencies.logError ?? ((m, c) => console.error(m, c))
    const { account, event, payment } = input as AsaasShadowInput
    log(message, { account, event, paymentId: payment?.id ?? null, reason })
  }
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}
