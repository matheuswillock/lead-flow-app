import { createAsaasClient } from "@/lib/asaas"
import { getFullUrl } from "@/lib/utils/app-url"
import { assertBillingTypeAllowed, resolveCardAvailability } from "@/lib/payment-methods/availability"
import type { IBillingPriceResolver } from "@/app/api/shared/billing/billingPriceTypes"
import {
  getHostedCheckoutUrl,
  createBillingCheckoutToken,
  hashBillingCheckoutToken,
  hashBillingQuote,
} from "@/lib/billing/billingCheckoutIntent"
import {
  billingCheckoutIntentRepository as defaultRepository,
} from "@/app/api/infra/data/repositories/billingCheckoutIntent/BillingCheckoutIntentRepository"
import type { IBillingCheckoutIntentRepository } from "@/app/api/infra/data/repositories/billingCheckoutIntent/IBillingCheckoutIntentRepository"

const ALLOWED_BILLING_TYPES = ["PIX", "CREDIT_CARD"] as const
type BillingType = (typeof ALLOWED_BILLING_TYPES)[number]

function isBillingType(value: string): value is BillingType {
  return ALLOWED_BILLING_TYPES.includes(value as BillingType)
}

function assertActiveIntent(intent: { status: string; expiresAt: Date }): void {
  if (intent.expiresAt.getTime() <= Date.now()) throw new Error("Este link de pagamento expirou")
  if (!["awaiting_method", "checkout_created"].includes(intent.status)) {
    throw new Error("Este link de pagamento não está disponível para novos pagamentos")
  }
  if (["paid", "subscription_created"].includes(intent.status)) {
    throw new Error("Este pagamento já foi confirmado")
  }
  if (intent.status === "manual_reconciliation") {
    throw new Error("Este pagamento precisa de reconciliação manual")
  }
}

export class BillingCheckoutIntentService {
  constructor(
    private readonly repository: IBillingCheckoutIntentRepository = defaultRepository,
    private readonly priceResolver: IBillingPriceResolver,
  ) {}

  async getPublicDetails(token: string) {
    const intent = await this.repository.findByTokenHash(hashBillingCheckoutToken(token))
    if (!intent) throw new Error("Link de pagamento inválido")
    assertActiveIntent(intent)

    const [pixPrice, cardPrice] = await Promise.all(
      (ALLOWED_BILLING_TYPES).map((method) =>
        this.priceResolver.resolvePrice({
          featureSlug: intent.productSlug,
          productId: intent.productId ?? undefined,
          cycle: intent.cycle as "monthly",
          method,
        })
      )
    )

    return {
      tokenPreview: intent.tokenPreview,
      productSlug: intent.productSlug,
      cycle: intent.cycle,
      prices: { PIX: pixPrice, CREDIT_CARD: cardPrice },
      availableBillingTypes: (await resolveCardAvailability()).availableBillingTypes,
      expiresAt: intent.expiresAt.toISOString(),
      checkoutCreated: intent.status === "checkout_created",
    }
  }

  async createCheckout(token: string, billingType: string) {
    if (!isBillingType(billingType)) throw new Error("Forma de pagamento inválida")
    await assertBillingTypeAllowed(billingType)
    let intent = await this.repository.findByTokenHash(hashBillingCheckoutToken(token))
    if (!intent) throw new Error("Link de pagamento inválido")
    assertActiveIntent(intent)

    const amount = await this.priceResolver.resolvePrice({
      featureSlug: intent.productSlug,
      productId: intent.productId ?? undefined,
      cycle: intent.cycle as "monthly",
      method: billingType,
    })
    if (amount == null) throw new Error("Preço indisponível no catálogo")

    const storedAmount = intent.amount == null ? null : Number(intent.amount.toString())
    const quoteChanged =
      intent.status === "checkout_created" &&
      (intent.billingType !== billingType || storedAmount == null || Math.abs(storedAmount - amount) > 0.005)
    if (quoteChanged) {
      await this.repository.markSuperseded(intent.id)
      const newToken = createBillingCheckoutToken()
      intent = await this.repository.create({
        profileId: intent.profileId,
        asaasCustomerId: intent.asaasCustomerId,
        asaasAccount: intent.asaasAccount,
        productSlug: intent.productSlug,
        productId: intent.productId,
        cycle: intent.cycle,
        externalReference: `${intent.externalReference}:${newToken.token.slice(0, 16)}`,
        tokenHash: newToken.tokenHash,
        tokenPreview: newToken.tokenPreview,
        expiresAt: intent.expiresAt,
      })
    }

    const reusable = await this.repository.findReusableCheckout({
      profileId: intent.profileId,
      asaasAccount: intent.asaasAccount,
      billingType,
      amount,
      now: new Date(),
    })
    if (reusable?.checkoutId && reusable.checkoutUrl) {
      const client = createAsaasClient(reusable.asaasAccount)
      try {
        const remote = await client.request(`${client.endpoints.checkouts}/${reusable.checkoutId}`, { method: "GET" })
        const remoteBillingTypes = Array.isArray(remote?.billingTypes) ? remote.billingTypes : []
        const remoteAmount = Number(remote?.items?.[0]?.value)
        const remoteExpiration = remote?.expirationDate ?? remote?.expiresAt
        const remoteIsUnexpired =
          !remoteExpiration || new Date(String(remoteExpiration)).getTime() > Date.now()
        const remoteIsValid =
          remote?.customer === reusable.asaasCustomerId &&
          remote?.externalReference === reusable.externalReference &&
          remoteBillingTypes.includes(billingType) &&
          Math.abs(remoteAmount - amount) <= 0.005 &&
          remoteIsUnexpired &&
          !["EXPIRED", "CANCELED", "CANCELLED"].includes(String(remote?.status ?? "").toUpperCase())
        if (!remoteIsValid) {
          await this.repository.markManualReconciliation(reusable.id, "remote_checkout_divergent")
          throw new Error("Checkout existente divergente; reconciliação manual obrigatória")
        }
        return {
          checkoutId: reusable.checkoutId,
          checkoutUrl: reusable.checkoutUrl,
          billingType,
          amount,
          reused: true,
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes("reconciliação manual")) throw error
        await this.repository.markManualReconciliation(reusable.id, "remote_checkout_unavailable")
        throw new Error("Não foi possível validar o checkout existente; reconciliação manual obrigatória")
      }
    }

    const quoteSnapshot = {
      profileId: intent.profileId,
      customerId: intent.asaasCustomerId,
      account: intent.asaasAccount,
      productSlug: intent.productSlug,
      productId: intent.productId,
      cycle: intent.cycle,
      billingType,
      amount,
      createdAt: new Date().toISOString(),
    }
    const quoteHash = hashBillingQuote(quoteSnapshot)
    const client = createAsaasClient(intent.asaasAccount)
    const checkout = await client.request(client.endpoints.checkouts, {
      method: "POST",
      body: JSON.stringify({
        externalReference: intent.externalReference,
        customer: intent.asaasCustomerId,
        billingTypes: [billingType],
        chargeTypes: ["DETACHED"],
        items: [{ name: "Plano CRM", description: "Acesso à plataforma Corretor Studio", value: amount, quantity: 1 }],
        callback: {
          successUrl: getFullUrl("/checkout-return"),
          cancelUrl: getFullUrl("/checkout-return"),
          expiredUrl: getFullUrl("/checkout-return"),
          autoRedirect: true,
        },
      }),
    })
    if (typeof checkout?.id !== "string" || checkout.id.length === 0) {
      throw new Error("Asaas não retornou o checkout")
    }

    const checkoutUrl = getHostedCheckoutUrl(checkout.id)
    await this.repository.markCheckoutCreated(intent.id, {
      billingType,
      amount,
      quoteSnapshot,
      quoteHash,
      checkoutId: checkout.id,
      checkoutUrl,
    })

    return { checkoutId: checkout.id, checkoutUrl, billingType, amount, reused: false }
  }

  static isIntentExternalReference(value: string | null | undefined): boolean {
    return Boolean(value?.startsWith("billing-intent:"))
  }
}
