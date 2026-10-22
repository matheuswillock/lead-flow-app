import { describe, expect, it, mock } from "bun:test"
import { InMemoryPaymentChargeRepository } from "@/test/support/in-memory-payment-charge-repository"
import { ChargeLedger } from "./ChargeLedger"
import { AsaasShadowMirror, inferAsaasChargePurpose } from "./AsaasShadowMirror"

const NOW = new Date("2026-10-21T12:00:00.000Z")

function makeMirror(lookup: { profileId: string; subscriptionId: string | null } | null = { profileId: "profile-1", subscriptionId: null }) {
  const charges = new InMemoryPaymentChargeRepository()
  const logError = mock((_m: string, _c: Record<string, unknown>) => undefined)
  const ledger = new ChargeLedger({ charges, now: () => NOW, logError })
  const mirror = new AsaasShadowMirror({
    ledger,
    profiles: { findProfileId: async () => lookup },
    environment: () => "PRODUCTION",
    logError,
  })
  return { mirror, charges, logError }
}

const payment = {
  id: "pay_1",
  status: "RECEIVED",
  value: 99.9,
  billingType: "PIX",
  dueDate: "2026-10-25",
  customer: "cus_1",
  externalReference: "manager-123",
}

describe("AsaasShadowMirror", () => {
  it("espelha o pagamento com ASAAS_SHADOW, conta do webhook, centavos e status normalizado", async () => {
    const { mirror, charges } = makeMirror()

    await mirror.mirrorPayment({ account: "legacy", event: "PAYMENT_RECEIVED", payment })

    expect(charges.charges[0]).toMatchObject({
      source: "ASAAS_SHADOW",
      provider: "ASAAS",
      providerContext: "legacy",
      providerEnvironment: "PRODUCTION",
      providerExternalId: "pay_1",
      amountCents: 9990,
      status: "CONFIRMED",
      rawStatus: "RECEIVED",
      method: "PIX",
      idempotencyKey: "asaas:legacy:pay_1",
      purpose: "SUBSCRIPTION_RENEWAL",
    })
    expect(charges.charges[0].dueDate).toEqual(new Date("2026-10-25T00:00:00.000Z"))
  })

  it("converte valor com ponto flutuante sem perder centavo (19.9 -> 1990)", async () => {
    const { mirror, charges } = makeMirror()

    await mirror.mirrorPayment({ account: "primary", event: "PAYMENT_CREATED", payment: { ...payment, value: 19.9, status: "PENDING" } })

    expect(charges.charges[0].amountCents).toBe(1990)
  })

  it("a mesma cobrança em contas diferentes não colide", async () => {
    const { mirror, charges } = makeMirror()

    await mirror.mirrorPayment({ account: "primary", event: "PAYMENT_RECEIVED", payment })
    await mirror.mirrorPayment({ account: "legacy", event: "PAYMENT_RECEIVED", payment })

    expect(charges.charges).toHaveLength(2)
  })

  it("eventos repetidos e em sequência atualizam a mesma linha com histórico", async () => {
    const { mirror, charges } = makeMirror()

    await mirror.mirrorPayment({ account: "primary", event: "PAYMENT_CREATED", payment: { ...payment, status: "PENDING" } })
    await mirror.mirrorPayment({ account: "primary", event: "PAYMENT_RECEIVED", payment })
    await mirror.mirrorPayment({ account: "primary", event: "PAYMENT_RECEIVED", payment })

    expect(charges.charges).toHaveLength(1)
    expect(charges.events.map((event) => event.toStatus)).toEqual(["PENDING", "CONFIRMED"])
  })

  it("PAYMENT_DELETED vira CANCELED", async () => {
    const { mirror, charges } = makeMirror()

    await mirror.mirrorPayment({ account: "primary", event: "PAYMENT_DELETED", payment: { ...payment, status: "PENDING" } })

    expect(charges.charges[0]).toMatchObject({ status: "CANCELED", rawStatus: "DELETED" })
  })

  it("perfil não resolvido: não grava e avisa (ausência fica visível para o job de divergência)", async () => {
    const { mirror, charges, logError } = makeMirror(null)

    await mirror.mirrorPayment({ account: "primary", event: "PAYMENT_RECEIVED", payment })

    expect(charges.charges).toHaveLength(0)
    expect(logError).toHaveBeenCalledTimes(1)
  })

  it("NUNCA lança: falha do lookup vira log", async () => {
    const mirror = new AsaasShadowMirror({
      ledger: new ChargeLedger({ charges: new InMemoryPaymentChargeRepository() }),
      profiles: { findProfileId: async () => { throw new Error("db caiu") } },
      environment: () => "PRODUCTION",
      logError: () => undefined,
    })

    await expect(mirror.mirrorPayment({ account: "primary", event: "PAYMENT_RECEIVED", payment })).resolves.toBeUndefined()
  })

  it("payload sem valor ou id é ignorado sem lançar", async () => {
    const { mirror, charges } = makeMirror()

    await mirror.mirrorPayment({ account: "primary", event: "PAYMENT_RECEIVED", payment: { id: "pay_2", status: "RECEIVED" } })

    expect(charges.charges).toHaveLength(0)
  })
})

describe("inferAsaasChargePurpose", () => {
  it("deduz a finalidade pela referência externa e pela assinatura", () => {
    expect(inferAsaasChargePurpose({ externalReference: "platform-purchase-1" })).toBe("PLATFORM_PURCHASE")
    expect(inferAsaasChargePurpose({ externalReference: "backoffice-adhesion-1" })).toBe("ADHESION")
    expect(inferAsaasChargePurpose({ externalReference: "subscription-change-order-1" })).toBe("CHANGE_ORDER")
    expect(inferAsaasChargePurpose({ externalReference: "pending-action-1" })).toBe("ADD_USER")
    expect(inferAsaasChargePurpose({ subscription: "sub_1" })).toBe("SUBSCRIPTION_RENEWAL")
    expect(inferAsaasChargePurpose({})).toBe("BACKOFFICE_CHARGE")
  })
})
