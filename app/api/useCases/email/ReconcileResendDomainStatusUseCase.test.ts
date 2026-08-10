import { beforeEach, describe, expect, it, mock } from "bun:test"
import type {
  ConnectedResendDomainRow,
  IEmailTeamDomainEventRepository,
} from "@/app/api/infra/data/repositories/emailTeamDomainEvent/EmailTeamDomainEventRepository"
import {
  ReconcileResendDomainStatusUseCase,
  type ResendDomainFetcher,
} from "./ReconcileResendDomainStatusUseCase"

const listConnectedDomainsMock = mock(async (): Promise<ConnectedResendDomainRow[]> => [])
const syncFromResendDomainMock = mock(async () => ({
  status: "partially_failed",
  region: "sa-east-1",
  openTracking: true,
  clickTracking: true,
  trackingSubdomain: "links",
}))
const fetchDomainMock = mock<ResendDomainFetcher>(async () => ({
  data: { id: "dom-1", status: "partially_failed" },
  error: null,
}))

function buildRepository(): IEmailTeamDomainEventRepository {
  return {
    listEvents: mock(async () => []),
    recordEventIfMissing: mock(async () => {}),
    findTeamByResendDomainId: mock(async () => null),
    updateDomainTracking: mock(async () => {}),
    clearDomainSettings: mock(async () => {}),
    syncFromResendDomain: syncFromResendDomainMock,
    listConnectedDomains: listConnectedDomainsMock,
  }
}

describe("ReconcileResendDomainStatusUseCase", () => {
  beforeEach(() => {
    listConnectedDomainsMock.mockClear()
    syncFromResendDomainMock.mockClear()
    fetchDomainMock.mockClear()
    listConnectedDomainsMock.mockImplementation(async () => [])
    fetchDomainMock.mockImplementation(async () => ({
      data: { id: "dom-1", status: "partially_failed" },
      error: null,
    }))
  })

  it("sincroniza quando status persistido difere do Resend", async () => {
    listConnectedDomainsMock.mockImplementation(async () => [
      {
        teamId: "team-1",
        resendDomainId: "dom-1",
        resendDomainName: "example.com",
        resendDomainStatus: "verified",
      },
    ])

    const useCase = new ReconcileResendDomainStatusUseCase(
      buildRepository(),
      fetchDomainMock
    )
    const result = await useCase.execute()

    expect(result.isValid).toBe(true)
    expect(result.result.synced).toBe(1)
    expect(result.result.inSync).toBe(0)
    expect(syncFromResendDomainMock).toHaveBeenCalledTimes(1)
  })

  it("não sincroniza quando status já está alinhado", async () => {
    listConnectedDomainsMock.mockImplementation(async () => [
      {
        teamId: "team-1",
        resendDomainId: "dom-1",
        resendDomainName: "example.com",
        resendDomainStatus: "partially_failed",
      },
    ])

    const useCase = new ReconcileResendDomainStatusUseCase(
      buildRepository(),
      fetchDomainMock
    )
    const result = await useCase.execute()

    expect(result.result.synced).toBe(0)
    expect(result.result.inSync).toBe(1)
    expect(syncFromResendDomainMock).not.toHaveBeenCalled()
  })

  it("conta erro quando Resend API falha", async () => {
    listConnectedDomainsMock.mockImplementation(async () => [
      {
        teamId: "team-1",
        resendDomainId: "dom-1",
        resendDomainName: "example.com",
        resendDomainStatus: "verified",
      },
    ])
    fetchDomainMock.mockImplementation(async () => ({
      data: null,
      error: "rate limit",
    }))

    const useCase = new ReconcileResendDomainStatusUseCase(
      buildRepository(),
      fetchDomainMock
    )
    const result = await useCase.execute()

    expect(result.result.errors).toBe(1)
    expect(syncFromResendDomainMock).not.toHaveBeenCalled()
  })
})
