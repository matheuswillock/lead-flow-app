import type { IProfileSubscriptionPaymentRepository } from "@/app/api/infra/data/repositories/paymentCharge/IProfileSubscriptionPaymentRepository"
import type { IPaymentProviderIdentityRepository } from "@/app/api/infra/data/repositories/paymentProviderIdentity/IPaymentProviderIdentityRepository"
import { resolveCohortFromSubscription } from "@/lib/payments/cohort"
import type { PaymentProviderEnvironment, PaymentProviderKey } from "@/lib/payment-provider/types"

export const SUBSCRIPTION_IDENTITY_OWNER_TYPE = "PROFILE_SUBSCRIPTION"
const ROUTE_VERSION = "PAY-LEDGER-R1"

export type LinkSubscriptionIdentityInput = {
  readonly profileId: string
  readonly provider: PaymentProviderKey
  readonly environment: PaymentProviderEnvironment
  readonly externalAccountContext: string
  readonly externalId: string
}

/**
 * Vínculo da assinatura externa em PaymentProviderIdentity (SUBSCRIPTION) para a coorte ROUTER.
 * As colunas asaas* ficam intactas como espelho da coorte ASAAS.
 */
export class SubscriptionIdentityLinker {
  constructor(
    private readonly dependencies: {
      readonly subscriptions: Pick<IProfileSubscriptionPaymentRepository, "findByProfileId">
      readonly identities: Pick<IPaymentProviderIdentityRepository, "bind">
    },
  ) {}

  async link(input: LinkSubscriptionIdentityInput): Promise<void> {
    const subscription = await this.dependencies.subscriptions.findByProfileId(input.profileId)
    if (!subscription) throw new Error("Assinatura não encontrada para o perfil")
    if (resolveCohortFromSubscription(subscription) !== "ROUTER") {
      throw new Error("Vínculo de assinatura externa só vale para a coorte ROUTER")
    }
    await this.dependencies.identities.bind({
      provider: input.provider,
      environment: input.environment,
      externalAccountContext: input.externalAccountContext,
      externalId: input.externalId,
      identityType: "SUBSCRIPTION",
      ownerType: SUBSCRIPTION_IDENTITY_OWNER_TYPE,
      ownerId: subscription.id,
      tenantId: input.profileId,
      route: "NEW_ROUTER",
      routeVersion: ROUTE_VERSION,
    })
  }
}
