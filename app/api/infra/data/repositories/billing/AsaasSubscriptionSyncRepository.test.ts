import { beforeEach, describe, expect, it, mock } from "bun:test"
import { prismaModuleMock, registerPrismaModuleMock } from "@/test/support/prisma-module-mock"

// Achado P1 da 4ª rodada de revisão do PR #1207 (chatgpt-codex-connector,
// thread PRRT_...ZZPb): `getSyncSnapshot` pareava o ID vencedor do fallback
// (o do ProfileSubscription) com a CONTA do Profile. No caso divergente que
// a correção do achado CUk2 preserva de propósito — ProfileSubscription de
// produto/conta diferente do ponteiro do Profile — isso consulta o Asaas na
// conta errada e 404 em série. O par (id, conta) tem de sair da MESMA linha.

const profileSubscriptionFindUniqueMock = mock(
  async (_args: unknown) => null as Record<string, unknown> | null
)
const profileFindUniqueMock = mock(async (_args: unknown) => null as Record<string, unknown> | null)

registerPrismaModuleMock()
Object.assign(prismaModuleMock, {
  profileSubscription: { findUnique: profileSubscriptionFindUniqueMock, upsert: mock(async () => ({})) },
  profile: { findUnique: profileFindUniqueMock, update: mock(async () => ({})) },
})

const { asaasSubscriptionSyncRepository } = await import("./AsaasSubscriptionSyncRepository")

describe("AsaasSubscriptionSyncRepository.getSyncSnapshot — par (id, conta) da mesma linha", () => {
  beforeEach(() => {
    profileSubscriptionFindUniqueMock.mockReset()
    profileFindUniqueMock.mockReset()
  })

  it("achado P1 PRRT_...ZZPb: quando o id da ProfileSubscription vence o fallback, a conta vem DELA — não do Profile", async () => {
    // Caso divergente suportado: o Profile já migrou para a primary, mas a
    // ProfileSubscription é de um produto que segue na legacy.
    profileSubscriptionFindUniqueMock.mockImplementation(async () => ({
      asaasSubscriptionId: "sub_produto_legacy",
      asaasSubscriptionAccount: "legacy",
      hasPermanentSubscription: false,
    }))
    profileFindUniqueMock.mockImplementation(async () => ({
      asaasSubscriptionId: "sub_profile_primary",
      asaasSubscriptionAccount: "primary",
      hasPermanentSubscription: false,
    }))

    const snapshot = await asaasSubscriptionSyncRepository.getSyncSnapshot("profile-1")

    expect(snapshot).toMatchObject({
      asaasSubscriptionId: "sub_produto_legacy",
      asaasSubscriptionAccount: "legacy",
    })
  })

  it("controle negativo: quando o fallback cai no ponteiro do Profile, a conta é a do Profile", async () => {
    // ProfileSubscription sem sub_ → quem vence é o Profile, e a conta tem
    // de ser a dele. Sem isso a correção acima quebraria o caminho comum.
    profileSubscriptionFindUniqueMock.mockImplementation(async () => ({
      asaasSubscriptionId: null,
      asaasSubscriptionAccount: "primary",
      hasPermanentSubscription: false,
    }))
    profileFindUniqueMock.mockImplementation(async () => ({
      asaasSubscriptionId: "sub_profile_legacy",
      asaasSubscriptionAccount: "legacy",
      hasPermanentSubscription: false,
    }))

    const snapshot = await asaasSubscriptionSyncRepository.getSyncSnapshot("profile-2")

    expect(snapshot).toMatchObject({
      asaasSubscriptionId: "sub_profile_legacy",
      asaasSubscriptionAccount: "legacy",
    })
  })

  it("controle negativo: ponteiros espelhados (mesma conta nos dois) seguem inalterados", async () => {
    profileSubscriptionFindUniqueMock.mockImplementation(async () => ({
      asaasSubscriptionId: "sub_mirror",
      asaasSubscriptionAccount: "legacy",
      hasPermanentSubscription: false,
    }))
    profileFindUniqueMock.mockImplementation(async () => ({
      asaasSubscriptionId: "sub_mirror",
      asaasSubscriptionAccount: "legacy",
      hasPermanentSubscription: false,
    }))

    const snapshot = await asaasSubscriptionSyncRepository.getSyncSnapshot("profile-3")

    expect(snapshot).toMatchObject({
      asaasSubscriptionId: "sub_mirror",
      asaasSubscriptionAccount: "legacy",
    })
  })

  it("sem ProfileSubscription nenhuma, cai no Profile inteiro", async () => {
    profileSubscriptionFindUniqueMock.mockImplementation(async () => null)
    profileFindUniqueMock.mockImplementation(async () => ({
      asaasSubscriptionId: "sub_only_profile",
      asaasSubscriptionAccount: "primary",
      hasPermanentSubscription: false,
    }))

    const snapshot = await asaasSubscriptionSyncRepository.getSyncSnapshot("profile-4")

    expect(snapshot).toMatchObject({
      asaasSubscriptionId: "sub_only_profile",
      asaasSubscriptionAccount: "primary",
    })
  })
})
