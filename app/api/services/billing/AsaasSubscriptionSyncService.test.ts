import { beforeEach, describe, expect, it, mock } from "bun:test"

// T-20.14 de [[20 — Assinaturas — Backend]] E4 (DA2).
const getSyncSnapshotMock = mock(async () => null as Record<string, unknown> | null)
const saveSyncDataMock = mock(async () => {})
mock.module("@/app/api/infra/data/repositories/billing/AsaasSubscriptionSyncRepository", () => ({
  asaasSubscriptionSyncRepository: {
    getSyncSnapshot: getSyncSnapshotMock,
    saveSyncData: saveSyncDataMock,
  },
}))

const requestMock = mock(async () => ({ id: "sub_1", status: "ACTIVE", cycle: "MONTHLY" }))
const createAsaasClientMock = mock((accountId: string) => ({
  endpoints: { subscriptions: `https://asaas.test/${accountId}/subscriptions` },
  request: requestMock,
}))
mock.module("@/lib/asaas", () => ({
  createAsaasClient: createAsaasClientMock,
  asaasFetch: mock(async () => ({})),
  asaasApi: { subscriptions: "https://asaas.test/primary/subscriptions" },
}))

const { AsaasSubscriptionSyncService } = await import("./AsaasSubscriptionSyncService")

describe("AsaasSubscriptionSyncService.syncFromAsaas — roteamento por conta (T-20.14)", () => {
  beforeEach(() => {
    getSyncSnapshotMock.mockClear()
    saveSyncDataMock.mockClear()
    createAsaasClientMock.mockClear()
  })

  it("perfil com asaasSubscriptionAccount=legacy → consulta via createAsaasClient('legacy')", async () => {
    getSyncSnapshotMock.mockImplementationOnce(async () => ({
      asaasSubscriptionId: "sub_legacy_1",
      hasPermanentSubscription: false,
      asaasSubscriptionAccount: "legacy",
    }))

    const service = new AsaasSubscriptionSyncService()
    await service.syncFromAsaas("profile-1")

    expect(createAsaasClientMock).toHaveBeenCalledWith("legacy")
  })

  it("perfil primary → consulta via createAsaasClient('primary')", async () => {
    getSyncSnapshotMock.mockImplementationOnce(async () => ({
      asaasSubscriptionId: "sub_primary_1",
      hasPermanentSubscription: false,
      asaasSubscriptionAccount: "primary",
    }))

    const service = new AsaasSubscriptionSyncService()
    await service.syncFromAsaas("profile-2")

    expect(createAsaasClientMock).toHaveBeenCalledWith("primary")
  })

  // Achado P1 (chatgpt-codex-connector, thread PRRT_...CUk4): saveSyncData
  // gravava asaasSubscriptionId sem a conta, deixando o upsert de
  // ProfileSubscription cair no @default(primary) mesmo quando o
  // ponteiro é legacy — a reconciliação de 30-E7 passa a procurar o sub_
  // na conta errada.
  it("propaga a conta resolvida para saveSyncData — nunca deixa o pointer sem conta (achado P1 PRRT_...CUk4)", async () => {
    getSyncSnapshotMock.mockImplementationOnce(async () => ({
      asaasSubscriptionId: "sub_legacy_1",
      hasPermanentSubscription: false,
      asaasSubscriptionAccount: "legacy",
    }))

    const service = new AsaasSubscriptionSyncService()
    await service.syncFromAsaas("profile-1")

    expect(saveSyncDataMock).toHaveBeenCalledWith(
      "profile-1",
      "sub_legacy_1",
      "legacy",
      expect.any(Object),
    )
  })

  it("controle negativo: perfil primary continua gravando a conta primary (não regride o caminho comum)", async () => {
    getSyncSnapshotMock.mockImplementationOnce(async () => ({
      asaasSubscriptionId: "sub_primary_1",
      hasPermanentSubscription: false,
      asaasSubscriptionAccount: "primary",
    }))

    const service = new AsaasSubscriptionSyncService()
    await service.syncFromAsaas("profile-2")

    expect(saveSyncDataMock).toHaveBeenCalledWith(
      "profile-2",
      "sub_primary_1",
      "primary",
      expect.any(Object),
    )
  })
})
