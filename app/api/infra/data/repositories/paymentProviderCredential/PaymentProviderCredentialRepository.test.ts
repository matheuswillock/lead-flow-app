import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { decryptProviderCredential } from "@/lib/payment-provider/credential-cipher"

const credentialUpsert = mock(async (_args: Record<string, unknown>) => ({}))
const transaction = {
  paymentProviderConfig: {
    findUnique: mock(async () => ({ id: "instance-1", providerKey: "ABACATE_PAY", environment: "PRODUCTION" })),
    updateMany: mock(async () => ({ count: 1 })),
    update: mock(async () => ({})),
    findUniqueOrThrow: mock(async () => ({
      id: "instance-1",
      providerKey: "ABACATE_PAY",
      environment: "PRODUCTION",
      displayName: "Production",
      externalAccountContext: "account-1",
      enabled: true,
      rolloutState: "ACTIVE",
      isDefault: true,
      healthStatus: "HEALTHY",
      lastHealthCheckAt: null,
      logoUrl: null,
      logoAltText: null,
      credentials: [],
    })),
  },
  paymentProviderCredential: {
    findUnique: mock(async () => null),
    upsert: credentialUpsert,
  },
}

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: { $transaction: async (run: (tx: typeof transaction) => Promise<unknown>) => run(transaction) },
}))

const { PaymentProviderCredentialRepository } = await import("./PaymentProviderCredentialRepository")

const previousEncryptionKey = process.env.PAYMENT_PROVIDER_ENCRYPTION_KEY
const previousWebhookSecret = process.env.ABACATE_PAY_PRODUCTION_WEBHOOK_SECRET

describe("PaymentProviderCredentialRepository", () => {
  beforeEach(() => {
    process.env.PAYMENT_PROVIDER_ENCRYPTION_KEY = "a".repeat(64)
    credentialUpsert.mockClear()
    credentialUpsert.mockImplementation(async () => ({}))
    transaction.paymentProviderCredential.findUnique.mockImplementation(async () => null)
  })

  afterEach(() => {
    if (previousEncryptionKey === undefined) delete process.env.PAYMENT_PROVIDER_ENCRYPTION_KEY
    else process.env.PAYMENT_PROVIDER_ENCRYPTION_KEY = previousEncryptionKey
    if (previousWebhookSecret === undefined) delete process.env.ABACATE_PAY_PRODUCTION_WEBHOOK_SECRET
    else process.env.ABACATE_PAY_PRODUCTION_WEBHOOK_SECRET = previousWebhookSecret
  })

  it("preserva o segredo legado do ambiente como anterior na primeira gravação no banco", async () => {
    process.env.ABACATE_PAY_PRODUCTION_WEBHOOK_SECRET = "legacy-webhook-secret"
    const repository = new PaymentProviderCredentialRepository()

    await repository.update({
      id: "instance-1",
      credentials: { WEBHOOK_SECRET: "rotated-webhook-secret" },
      actorProfileId: "profile-1",
    })

    const previousCredential = credentialUpsert.mock.calls
      .map(([args]) => args as { create?: { key?: string; valueCiphertext?: string; keyId?: string } })
      .find(({ create }) => create?.key === "WEBHOOK_SECRET_PREVIOUS")?.create

    expect(previousCredential).toBeDefined()
    expect(decryptProviderCredential(previousCredential!.valueCiphertext!, previousCredential!.keyId!))
      .toBe("legacy-webhook-secret")
  })
})
