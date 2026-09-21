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
const profileUpdateMock = mock(async (_args: unknown) => ({ id: "profile-1" }))
const profileFindUniqueOrThrowMock = mock(async (_args: unknown) => ({ id: "profile-1" }))

registerPrismaModuleMock()
Object.assign(prismaModuleMock, {
  profileSubscription: { upsert: profileSubscriptionUpsertMock },
  profile: { update: profileUpdateMock, findUniqueOrThrow: profileFindUniqueOrThrowMock },
})

const { PaymentRepository } = await import("./PaymentRepository")

describe("PaymentRepository.updateSubscriptionData — conta junto do id (achado P1 PRRT_...YP_y)", () => {
  beforeEach(() => {
    profileSubscriptionUpsertMock.mockClear()
    profileUpdateMock.mockClear()
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

  it("controle negativo: evento da conta primary continua gravando primary", async () => {
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
