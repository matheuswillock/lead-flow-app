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
})
