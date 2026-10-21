import type { IPaymentChargeRepository } from "@/app/api/infra/data/repositories/paymentCharge/IPaymentChargeRepository"
import type {
  OwnerSettlementInput,
  OwnerSettlementResult,
  PaymentOwnerSettlement,
} from "@/lib/payments/owner-settlement"
import { PAYMENT_PROVIDER_OWNER_TYPES } from "@/lib/payment-provider/owner-types"
import type { ChargePurpose } from "@/lib/payments/types"
import type { ChargeLedger } from "./ChargeLedger"
import type { ChargePurposeSettlementHandlers } from "./chargePurposeHandlers"

export type UnsupportedPurposeReport = {
  readonly chargeId: string
  readonly purpose: ChargePurpose
  readonly profileId: string
  readonly externalId: string
}

export type PaymentChargeSettlementDependencies = {
  readonly charges: Pick<IPaymentChargeRepository, "findById">
  readonly ledger: Pick<ChargeLedger, "transition">
  readonly handlers: ChargePurposeSettlementHandlers
  readonly reportUnsupportedPurpose: (report: UnsupportedPurposeReport) => void
}

const ACTOR = "PAYMENT_CHARGE_SETTLEMENT"

/** Liquidação do ownerType PAYMENT_CHARGE: despacha por finalidade. */
export class PaymentChargeSettlementService implements PaymentOwnerSettlement {
  constructor(private readonly dependencies: PaymentChargeSettlementDependencies) {}

  async settleConfirmed(input: OwnerSettlementInput): Promise<OwnerSettlementResult> {
    if (input.ownerType !== PAYMENT_PROVIDER_OWNER_TYPES.PAYMENT_CHARGE) return "unsupported"
    const { charges, ledger, handlers, reportUnsupportedPurpose } = this.dependencies

    const charge = await charges.findById(input.ownerId)
    if (!charge) throw new Error("Cobrança não encontrada")
    if (charge.status === "COMPLETED") return "settled"

    const handler = handlers[charge.purpose as ChargePurpose]
    if (!handler) {
      reportUnsupportedPurpose({
        chargeId: charge.id,
        purpose: charge.purpose as ChargePurpose,
        profileId: charge.profileId,
        externalId: input.externalId,
      })
      return "unsupported"
    }

    const confirmed = await ledger.transition({
      chargeId: charge.id,
      toStatus: "CONFIRMED",
      paidAt: input.paidAt,
      actor: ACTOR,
    })
    await handler.settle(confirmed)
    await ledger.transition({ chargeId: charge.id, toStatus: "COMPLETED", actor: ACTOR })
    return "settled"
  }
}
