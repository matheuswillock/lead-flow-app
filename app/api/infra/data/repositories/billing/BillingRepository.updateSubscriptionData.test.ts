import { beforeEach, describe, expect, it } from "bun:test"
import { mock } from "bun:test"
import { prismaModuleMock, registerPrismaModuleMock } from "@/test/support/prisma-module-mock"

// Achado P1 da revisão do PR #1207 (chatgpt-codex-connector, thread
// PRRT_...CUk4): `updateSubscriptionData` gravava `asaasSubscriptionId` sem
// `asaasSubscriptionAccount` — o upsert de ProfileSubscription caía no
// `@default(primary)` do schema mesmo quando o pointer é legacy, e o mesmo
// vale para o `profile.update` que mantém os dois em sincronia.

const profileSubscriptionUpsertMock = mock(async (_args: unknown) => ({}))
const profileUpdateMock = mock(async (_args: unknown) => ({}))

registerPrismaModuleMock()
Object.assign(prismaModuleMock, {
  profileSubscription: { upsert: profileSubscriptionUpsertMock },
  profile: { update: profileUpdateMock },
})

const { billingRepository } = await import("./BillingRepository")

describe("BillingRepository.updateSubscriptionData — conta obrigatória junto do id (achado P1 PRRT_...CUk4)", () => {
  beforeEach(() => {
    profileSubscriptionUpsertMock.mockClear()
    profileUpdateMock.mockClear()
  })

  it("grava asaasSubscriptionAccount='legacy' no upsert de ProfileSubscription e no update de Profile", async () => {
    await billingRepository.updateSubscriptionData("profile-1", {
      asaasSubscriptionId: "sub_legacy_1",
      asaasSubscriptionAccount: "legacy",
      subscriptionNextDueDate: new Date("2026-11-01T00:00:00.000Z"),
      subscriptionCycle: "MONTHLY",
    })

    expect(profileSubscriptionUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { profileId: "profile-1" },
        create: expect.objectContaining({
          asaasSubscriptionId: "sub_legacy_1",
          asaasSubscriptionAccount: "legacy",
        }),
        update: expect.objectContaining({
          asaasSubscriptionId: "sub_legacy_1",
          asaasSubscriptionAccount: "legacy",
        }),
      })
    )
    expect(profileUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "profile-1" },
        data: expect.objectContaining({
          asaasSubscriptionId: "sub_legacy_1",
          asaasSubscriptionAccount: "legacy",
        }),
      })
    )
  })

  it("controle negativo: caminho comum (conta primary) continua gravando primary nos dois lados", async () => {
    await billingRepository.updateSubscriptionData("profile-2", {
      asaasSubscriptionId: "sub_primary_1",
      asaasSubscriptionAccount: "primary",
      subscriptionNextDueDate: new Date("2026-11-01T00:00:00.000Z"),
      subscriptionCycle: "MONTHLY",
    })

    expect(profileSubscriptionUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ asaasSubscriptionAccount: "primary" }),
        update: expect.objectContaining({ asaasSubscriptionAccount: "primary" }),
      })
    )
    expect(profileUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ asaasSubscriptionAccount: "primary" }),
      })
    )
  })
})
