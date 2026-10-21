import { backofficeAdhesionPaymentRepository } from "@/app/api/infra/data/repositories/backofficeAdhesionPayment/BackofficeAdhesionPaymentRepository"
import { BackofficeAdhesionRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeAdhesion/BackofficeAdhesionRepository"
import { billingGracePaymentRepository } from "@/app/api/infra/data/repositories/billingGracePayment/BillingGracePaymentRepository"
import { paymentChargeRepository } from "@/app/api/infra/data/repositories/paymentCharge/PaymentChargeRepository"
import { paymentProviderSessionRepository } from "@/app/api/infra/data/repositories/paymentProviderSession/PaymentProviderSessionRepository"
import { platformPurchaseRepository } from "@/app/api/infra/data/repositories/platformPurchase/PlatformPurchaseRepository"
import { PAYMENT_PROVIDER_OWNER_TYPES } from "@/lib/payment-provider/owner-types"
import { ChargeLedger } from "./ChargeLedger"
import { createChargePurposeSettlementHandlers } from "./chargePurposeHandlers"
import {
  adhesionPaymentChargeStatus,
  gracePaymentChargeStatus,
  purchaseChargeStatus,
} from "./ownerChargeStatus"
import { OwnerChargeMirror, type OwnerChargeSnapshot, type OwnerChargeSource } from "./OwnerChargeMirror"
import { PaymentChargeSettlementService } from "./PaymentChargeSettlementService"
import { reportUnsupportedChargePurpose } from "./reportUnsupportedChargePurpose"

export const chargeLedger = new ChargeLedger({ charges: paymentChargeRepository })

export function createPaymentChargeSettlement(): PaymentChargeSettlementService {
  return new PaymentChargeSettlementService({
    charges: paymentChargeRepository,
    ledger: chargeLedger,
    handlers: createChargePurposeSettlementHandlers(),
    reportUnsupportedPurpose: reportUnsupportedChargePurpose,
  })
}

export function createOwnerChargeMirror(): OwnerChargeMirror {
  return new OwnerChargeMirror({
    ledger: chargeLedger,
    source: createOwnerChargeSource(),
    attempts: paymentProviderSessionRepository,
  })
}

function createOwnerChargeSource(): OwnerChargeSource {
  const adhesions = new BackofficeAdhesionRepository()
  return {
    async snapshot(ownerType, ownerId): Promise<OwnerChargeSnapshot | null> {
      if (ownerType === PAYMENT_PROVIDER_OWNER_TYPES.PLATFORM_PURCHASE) {
        const purchase = await platformPurchaseRepository.findById(ownerId)
        if (!purchase) return null
        return {
          profileId: purchase.profileId,
          purpose: "PLATFORM_PURCHASE",
          purposeRefId: purchase.id,
          status: purchaseChargeStatus(purchase.status),
          amountCents: Math.round(Number(purchase.amount) * 100),
          method: purchase.billingType,
        }
      }
      if (ownerType === PAYMENT_PROVIDER_OWNER_TYPES.BILLING_GRACE_PAYMENT) {
        const grace = await billingGracePaymentRepository.findById(ownerId)
        if (!grace) return null
        return {
          profileId: grace.accountId,
          purpose: "GRACE",
          purposeRefId: grace.id,
          status: gracePaymentChargeStatus(grace.status),
          amountCents: grace.amountCents,
          method: "PIX",
        }
      }
      if (ownerType === PAYMENT_PROVIDER_OWNER_TYPES.BACKOFFICE_ADHESION) {
        const payment = await backofficeAdhesionPaymentRepository.findById(ownerId)
        if (!payment) return null
        const adhesion = await adhesions.findById(payment.adhesionId)
        // Sem conta criada ainda não há perfil dono; o espelho espera a próxima passagem.
        if (!adhesion?.createdProfileId) return null
        return {
          profileId: adhesion.createdProfileId,
          purpose: "ADHESION",
          purposeRefId: payment.id,
          status: adhesionPaymentChargeStatus(payment.status),
          amountCents: payment.amountCents,
          method: "PIX",
        }
      }
      return null
    },
  }
}
