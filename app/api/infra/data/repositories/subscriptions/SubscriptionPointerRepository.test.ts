import { beforeEach, describe, expect, it, mock } from "bun:test"
import { prismaModuleMock, registerPrismaModuleMock } from "@/test/support/prisma-module-mock"

// Achado P1 da 3ª rodada de revisão do PR #1207 (chatgpt-codex-connector,
// thread PRRT_...YP_r): os dois ponteiros de assinatura (Profile e
// ProfileSubscription) eram gravados em duas chamadas soltas dentro do
// UseCase. Se a segunda falhasse depois da primeira ter passado, o Profile
// ficava apontando para a assinatura nova da primary e a ProfileSubscription
// retinha o id legado — e `getSyncSnapshot` combina o id da
// ProfileSubscription com a conta do Profile, consultando a conta errada
// no Asaas. As duas escritas passam a ser uma transação só.

const profileUpdateMock = mock(async (_args: unknown) => ({}))
const profileSubscriptionUpdateManyMock = mock(async (_args: unknown) => ({ count: 1 }))

/** Registra as chamadas na ORDEM em que a transação as recebe. */
const transactionMock = mock(async (operations: unknown) => {
  if (typeof operations === "function") {
    return (operations as (tx: unknown) => Promise<unknown>)({
      profile: { update: profileUpdateMock },
      profileSubscription: { updateMany: profileSubscriptionUpdateManyMock },
    })
  }
  return Promise.all(operations as Promise<unknown>[])
})

registerPrismaModuleMock()
Object.assign(prismaModuleMock, {
  profile: { update: profileUpdateMock },
  profileSubscription: { updateMany: profileSubscriptionUpdateManyMock },
  $transaction: transactionMock,
})

const { subscriptionPointerRepository } = await import("./SubscriptionPointerRepository")

describe("SubscriptionPointerRepository.migrateSubscriptionPointers (achado P1 PRRT_...YP_r)", () => {
  beforeEach(() => {
    profileUpdateMock.mockClear()
    profileSubscriptionUpdateManyMock.mockClear()
    transactionMock.mockClear()
    profileUpdateMock.mockImplementation(async () => ({}))
    profileSubscriptionUpdateManyMock.mockImplementation(async () => ({ count: 1 }))
  })

  it("grava os dois ponteiros dentro de UMA transação", async () => {
    await subscriptionPointerRepository.migrateSubscriptionPointers({
      profileId: "manager-1",
      previousSubscriptionId: "sub_legacy_1",
      newSubscriptionId: "sub_primary_new",
      account: "primary",
      subscriptionNextDueDate: new Date("2026-11-01T00:00:00.000Z"),
      operatorCount: 1,
    })

    expect(transactionMock).toHaveBeenCalledTimes(1)
    expect(profileUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "manager-1" },
        data: expect.objectContaining({
          asaasSubscriptionId: "sub_primary_new",
          asaasSubscriptionAccount: "primary",
        }),
      })
    )
    // Filtro pelo id ANTIGO — nunca sobrescreve ProfileSubscription de
    // produto/adesão distinta (schema.prisma:4204).
    expect(profileSubscriptionUpdateManyMock).toHaveBeenCalledWith({
      where: { profileId: "manager-1", asaasSubscriptionId: "sub_legacy_1" },
      data: {
        asaasSubscriptionId: "sub_primary_new",
        asaasSubscriptionAccount: "primary",
      },
    })
  })

  it("falha na segunda escrita propaga o erro — nada de sucesso parcial silencioso", async () => {
    profileSubscriptionUpdateManyMock.mockImplementation(async () => {
      throw new Error("db down")
    })

    await expect(
      subscriptionPointerRepository.migrateSubscriptionPointers({
        profileId: "manager-1",
        previousSubscriptionId: "sub_legacy_1",
        newSubscriptionId: "sub_primary_new",
        account: "primary",
        subscriptionNextDueDate: new Date("2026-11-01T00:00:00.000Z"),
        operatorCount: 1,
      })
    ).rejects.toThrow("db down")

    // A transação foi aberta — o rollback é do Postgres, e o erro sobe.
    expect(transactionMock).toHaveBeenCalledTimes(1)
  })

  it("controle negativo: caminho feliz não lança e mantém as duas escritas", async () => {
    await expect(
      subscriptionPointerRepository.migrateSubscriptionPointers({
        profileId: "manager-2",
        previousSubscriptionId: "sub_old",
        newSubscriptionId: "sub_new",
        account: "primary",
        subscriptionNextDueDate: new Date("2026-12-01T00:00:00.000Z"),
        operatorCount: 3,
      })
    ).resolves.toBeUndefined()

    expect(profileUpdateMock).toHaveBeenCalledTimes(1)
    expect(profileSubscriptionUpdateManyMock).toHaveBeenCalledTimes(1)
  })
})
