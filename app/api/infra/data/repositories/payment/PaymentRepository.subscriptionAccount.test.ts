import { beforeEach, describe, expect, it, mock } from "bun:test"
import { prismaModuleMock, registerPrismaModuleMock } from "@/test/support/prisma-module-mock"

// Achado P1 da 3ª rodada de revisão do PR #1207 (chatgpt-codex-connector,
// thread PRRT_...YP_y): `PaymentRepository.updateSubscriptionData` é o write
// site do caminho de webhook legado (SUBSCRIPTION_CREATED/UPDATED) e gravava
// o `asaasSubscriptionId` sem a conta — o upsert de ProfileSubscription caía
// no `@default(primary)` do schema mesmo quando o evento veio da conta
// legacy, e a reconciliação de 30-E7 passava a procurar o sub_ na conta
// errada. `processAsaasWebhookEvent` já conhece a conta; ela só precisava
// atravessar DTO → UseCase → Service → Repository.

const profileSubscriptionUpsertMock = mock(async (_args: unknown) => ({}))
const profileUpdateMock = mock(async (_args?: { data?: Record<string, unknown> }) => ({
  id: "profile-1",
}))
const profileFindUniqueOrThrowMock = mock(async (_args: unknown) => ({ id: "profile-1" }))
/** Ponteiro atual do Profile — decide se a conta pode ser copiada pra lá. */
const profileFindUniqueMock = mock(
  async (_args: unknown) => ({ asaasSubscriptionId: null }) as { asaasSubscriptionId: string | null } | null
)

registerPrismaModuleMock()
Object.assign(prismaModuleMock, {
  profileSubscription: { upsert: profileSubscriptionUpsertMock },
  profile: {
    update: profileUpdateMock,
    findUniqueOrThrow: profileFindUniqueOrThrowMock,
    findUnique: profileFindUniqueMock,
  },
})

const { PaymentRepository } = await import("./PaymentRepository")

describe("PaymentRepository.updateSubscriptionData — conta junto do id (achado P1 PRRT_...YP_y)", () => {
  beforeEach(() => {
    profileSubscriptionUpsertMock.mockClear()
    profileUpdateMock.mockClear()
    profileFindUniqueMock.mockReset()
    // Default: o Profile aponta para a MESMA assinatura do evento, então
    // copiar a conta pra lá é correto.
    profileFindUniqueMock.mockImplementation(async () => ({
      asaasSubscriptionId: "sub_legacy_webhook",
    }))
  })

  it("evento da conta legacy grava asaasSubscriptionAccount='legacy' no upsert e no Profile", async () => {
    const repo = new PaymentRepository()

    await repo.updateSubscriptionData("profile-1", {
      subscriptionId: "sub_legacy_webhook",
      subscriptionAccount: "legacy",
      subscriptionStatus: "active",
    })

    expect(profileSubscriptionUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { profileId: "profile-1" },
        create: expect.objectContaining({
          asaasSubscriptionId: "sub_legacy_webhook",
          asaasSubscriptionAccount: "legacy",
        }),
        update: expect.objectContaining({
          asaasSubscriptionId: "sub_legacy_webhook",
          asaasSubscriptionAccount: "legacy",
        }),
      })
    )
    expect(profileUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ asaasSubscriptionAccount: "legacy" }),
      })
    )
  })

  /**
   * Achado P1 da 4ª rodada (chatgpt-codex-connector, thread PRRT_...ZZPj):
   * este método nunca grava `asaasSubscriptionId` no Profile — só no
   * ProfileSubscription. Copiar a conta pra lá quando o ponteiro do Profile
   * é OUTRA assinatura monta um par inconsistente `(id primary, conta
   * legacy)`, e as operações roteadas por conta passam a bater na conta
   * errada. Cenário real: pagar uma assinatura de produto legada enquanto o
   * Profile aponta para a assinatura primária.
   */
  it("achado P1 PRRT_...ZZPj: conta NÃO é copiada para o Profile quando o ponteiro dele é outra assinatura", async () => {
    profileFindUniqueMock.mockImplementation(async () => ({
      asaasSubscriptionId: "sub_profile_primary",
    }))
    const repo = new PaymentRepository()

    await repo.updateSubscriptionData("profile-dual", {
      subscriptionId: "sub_produto_legacy",
      subscriptionAccount: "legacy",
      subscriptionStatus: "active",
    })

    // A linha da assinatura recebe a conta correta...
    expect(profileSubscriptionUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ asaasSubscriptionAccount: "legacy" }),
      })
    )
    // ...mas o Profile, que aponta para outra assinatura, não é rotulado.
    const profileWrites = profileUpdateMock.mock.calls.filter(
      (call) => call[0]?.data !== undefined && "asaasSubscriptionAccount" in call[0].data
    )
    expect(profileWrites).toHaveLength(0)
  })

  it("controle negativo: Profile sem ponteiro próprio também não é rotulado", async () => {
    profileFindUniqueMock.mockImplementation(async () => ({ asaasSubscriptionId: null }))
    const repo = new PaymentRepository()

    await repo.updateSubscriptionData("profile-sem-ponteiro", {
      subscriptionId: "sub_qualquer",
      subscriptionAccount: "legacy",
      subscriptionStatus: "active",
    })

    const profileWrites = profileUpdateMock.mock.calls.filter(
      (call) => call[0]?.data !== undefined && "asaasSubscriptionAccount" in call[0].data
    )
    expect(profileWrites).toHaveLength(0)
  })

  it("controle negativo: evento da conta primary continua gravando primary", async () => {
    profileFindUniqueMock.mockImplementation(async () => ({
      asaasSubscriptionId: "sub_primary_webhook",
    }))
    const repo = new PaymentRepository()

    await repo.updateSubscriptionData("profile-2", {
      subscriptionId: "sub_primary_webhook",
      subscriptionAccount: "primary",
      subscriptionStatus: "active",
    })

    expect(profileSubscriptionUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ asaasSubscriptionAccount: "primary" }),
        update: expect.objectContaining({ asaasSubscriptionAccount: "primary" }),
      })
    )
  })

  it("controle negativo: update que não toca o ponteiro (só status) não grava conta nenhuma", async () => {
    // PAYMENT_OVERDUE / refund só mudam status — não podem rotular a conta,
    // que continua sendo a que o ponteiro já tinha.
    const repo = new PaymentRepository()

    await repo.updateSubscriptionData("profile-3", { subscriptionStatus: "past_due" })

    const upsertArgs = profileSubscriptionUpsertMock.mock.calls[0]?.[0] as
      | { create: Record<string, unknown>; update: Record<string, unknown> }
      | undefined
    expect(upsertArgs?.update).not.toHaveProperty("asaasSubscriptionAccount")
    expect(upsertArgs?.update).not.toHaveProperty("asaasSubscriptionId")
  })
})
