import type { PaymentCharge } from "@prisma/client"
import type { IAsaasPaymentEventSourceRepository } from "@/app/api/infra/data/repositories/paymentCharge/IAsaasPaymentEventSourceRepository"
import type { IPaymentProviderSessionRepository } from "@/app/api/infra/data/repositories/paymentProviderSession/IPaymentProviderSessionRepository"
import { PAYMENT_PROVIDER_OWNER_TYPES } from "@/lib/payment-provider/owner-types"
import { chargeStatusFromAsaas, chargeStatusFromAttempt } from "@/lib/payments/charge-status"
import type { ChargePurpose } from "@/lib/payments/types"
import type { ChargeSourceReader } from "./ChargeDivergenceService"
import type { OwnerChargeSource } from "./OwnerChargeMirror"

const OWNER_TYPE_BY_PURPOSE: Partial<Record<ChargePurpose, string>> = {
  PLATFORM_PURCHASE: PAYMENT_PROVIDER_OWNER_TYPES.PLATFORM_PURCHASE,
  GRACE: PAYMENT_PROVIDER_OWNER_TYPES.BILLING_GRACE_PAYMENT,
  ADHESION: PAYMENT_PROVIDER_OWNER_TYPES.BACKOFFICE_ADHESION,
}

export type ChargeSourceReaderDependencies = {
  readonly asaasEvents: IAsaasPaymentEventSourceRepository
  readonly attempts: Pick<IPaymentProviderSessionRepository, "findAttemptById">
  readonly owners: OwnerChargeSource
}

export function createChargeSourceReader(dependencies: ChargeSourceReaderDependencies): ChargeSourceReader {
  return {
    async read(charge: PaymentCharge) {
      return charge.source === "ASAAS_SHADOW"
        ? readAsaasShadow(dependencies, charge)
        : readMirror(dependencies, charge)
    },
    listExpectedShadowPayments: (input) => dependencies.asaasEvents.listPaymentIdsReceivedSince(input),
  }
}

async function readAsaasShadow({ asaasEvents }: ChargeSourceReaderDependencies, charge: PaymentCharge) {
  if (!charge.providerExternalId) return null
  const event = await asaasEvents.findLatestPaymentEvent({
    account: charge.providerContext as "primary" | "legacy",
    paymentId: charge.providerExternalId,
  })
  if (!event) return null
  const deleted = event.event === "PAYMENT_DELETED"
  return {
    amountCents: event.valueInReais === null ? null : Math.round(event.valueInReais * 100),
    status: chargeStatusFromAsaas(deleted ? "DELETED" : event.status),
  }
}

async function readMirror({ attempts, owners }: ChargeSourceReaderDependencies, charge: PaymentCharge) {
  if (!charge.providerAttemptId) return null
  const attempt = await attempts.findAttemptById(charge.providerAttemptId)
  if (!attempt) return null
  const ownerType = OWNER_TYPE_BY_PURPOSE[charge.purpose as ChargePurpose]
  const owner = ownerType && charge.purposeRefId ? await owners.snapshot(ownerType, charge.purposeRefId) : null
  return {
    amountCents: owner?.amountCents ?? null,
    status: chargeStatusFromAttempt(attempt.status),
  }
}
