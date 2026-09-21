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
/**
 * Guard condicional do ponteiro do Profile. Achado P1 PRRT_...aTIu: tem de
 * ser um `updateMany` com a condição no `where` (avaliada pelo Postgres),
 * não um read-then-write — senão um upgrade concorrente troca o
 * `asaasSubscriptionId` entre a leitura e a escrita.
 */
const profileUpdateManyMock = mock(async (_args?: { where?: Record<string, unknown> }) => ({
  count: 1,
}))

registerPrismaModuleMock()
Object.assign(prismaModuleMock, {
  profileSubscription: { upsert: profileSubscriptionUpsertMock },
  profile: {
    update: profileUpdateMock,
    updateMany: profileUpdateManyMock,
    findUniqueOrThrow: profileFindUniqueOrThrowMock,
  },
})

const { PaymentRepository } = await import("./PaymentRepository")

describe("PaymentRepository.updateSubscriptionData — conta junto do id (achado P1 PRRT_...YP_y)", () => {
  beforeEach(() => {
    profileSubscriptionUpsertMock.mockClear()
    profileUpdateMock.mockClear()
    profileUpdateManyMock.mockClear()
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
    expect(profileUpdateManyMock).toHaveBeenCalledWith({
      where: { id: "profile-1", asaasSubscriptionId: "sub_legacy_webhook" },
      data: { asaasSubscriptionAccount: "legacy" },
    })
  })

  /**
   * Achados P1 da 4ª e 5ª rodadas (chatgpt-codex-connector, threads
   * PRRT_...ZZPj e PRRT_...aTIu): este método nunca grava
   * `asaasSubscriptionId` no Profile — só no ProfileSubscription. Copiar a
   * conta pra lá quando o ponteiro do Profile é OUTRA assinatura monta um
   * par inconsistente `(id primary, conta legacy)`. E o guard tem de ser
   * condicional NO BANCO: um read-then-write deixa a janela para um upgrade
   * concorrente trocar o ponteiro entre a leitura e a escrita.
   */
  it("achados P1 PRRT_...ZZPj/aTIu: o guard é um updateMany condicional — a condição vai no where, não num read-then-write", async () => {
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
    // ...e o Profile só é rotulado pelo `where` casando os DOIS campos, o
    // que o Postgres avalia atomicamente. Se o ponteiro for outro, o
    // updateMany simplesmente não acha linha (count: 0).
    expect(profileUpdateManyMock).toHaveBeenCalledWith({
      where: { id: "profile-dual", asaasSubscriptionId: "sub_produto_legacy" },
      data: { asaasSubscriptionAccount: "legacy" },
    })
    // O `update` incondicional de compatibilidade nunca carrega a conta.
    const unconditionalAccountWrites = profileUpdateMock.mock.calls.filter(
      (call) => call[0]?.data !== undefined && "asaasSubscriptionAccount" in call[0].data
    )
    expect(unconditionalAccountWrites).toHaveLength(0)
  })

  it("controle negativo: ponteiro divergente não rotula o Profile (updateMany não casa nenhuma linha)", async () => {
    profileUpdateManyMock.mockImplementationOnce(async () => ({ count: 0 }))
    const repo = new PaymentRepository()

    await repo.updateSubscriptionData("profile-sem-ponteiro", {
      subscriptionId: "sub_qualquer",
      subscriptionAccount: "legacy",
      subscriptionStatus: "active",
    })

    // A condição está no where — nenhuma linha atingida, nenhum par
    // inconsistente criado, e o fluxo segue sem erro.
    expect(profileUpdateManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ asaasSubscriptionId: "sub_qualquer" }),
      })
    )
    const unconditionalAccountWrites = profileUpdateMock.mock.calls.filter(
      (call) => call[0]?.data !== undefined && "asaasSubscriptionAccount" in call[0].data
    )
    expect(unconditionalAccountWrites).toHaveLength(0)
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
    // Sem `subscriptionId`, o guard condicional nem é acionado.
    expect(profileUpdateManyMock).not.toHaveBeenCalled()
  })
})
