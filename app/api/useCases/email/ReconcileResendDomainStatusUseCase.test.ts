import { beforeEach, describe, expect, it, mock } from "bun:test"
import type {
  ConnectedResendDomainRow,
  IEmailTeamDomainEventRepository,
} from "@/app/api/infra/data/repositories/emailTeamDomainEvent/EmailTeamDomainEventRepository"
import {
  ReconcileResendDomainStatusUseCase,
  type ResendDomainFetcher,
} from "./ReconcileResendDomainStatusUseCase"

function connectedDomain(
  overrides: Partial<ConnectedResendDomainRow> &
    Pick<ConnectedResendDomainRow, "teamId" | "resendDomainId">
): ConnectedResendDomainRow {
  return {
    resendDomainName: "example.com",
    resendDomainStatus: "verified",
    resendDomainRegion: "sa-east-1",
    resendOpenTracking: true,
    resendClickTracking: true,
    ...overrides,
  }
}

const listConnectedDomainsMock = mock(async (): Promise<ConnectedResendDomainRow[]> => [])
const syncFromResendDomainMock = mock(async () => ({
  status: "partially_failed",
  region: "sa-east-1",
  openTracking: true,
  clickTracking: true,
  trackingSubdomain: "links",
}))
const fetchDomainMock = mock<ResendDomainFetcher>(async () => ({
  data: {
    id: "dom-1",
    status: "partially_failed",
    region: "sa-east-1",
    openTracking: true,
    clickTracking: true,
  },
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
      data: {
        id: "dom-1",
        status: "partially_failed",
        region: "sa-east-1",
        openTracking: true,
        clickTracking: true,
      },
      error: null,
    }))
  })

  it("sincroniza quando status persistido difere do Resend", async () => {
    listConnectedDomainsMock.mockImplementation(async () => [
      connectedDomain({
        teamId: "team-1",
        resendDomainId: "dom-1",
        resendDomainStatus: "verified",
      }),
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

  it("não sincroniza quando snapshot já está alinhado", async () => {
    listConnectedDomainsMock.mockImplementation(async () => [
      connectedDomain({
        teamId: "team-1",
        resendDomainId: "dom-1",
        resendDomainStatus: "partially_failed",
      }),
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

  it("sincroniza quando status bate mas tracking/região difere", async () => {
    listConnectedDomainsMock.mockImplementation(async () => [
      connectedDomain({
        teamId: "team-1",
        resendDomainId: "dom-1",
        resendDomainStatus: "partially_failed",
        resendDomainRegion: "us-east-1",
        resendOpenTracking: false,
        resendClickTracking: false,
      }),
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

  it("conta erro quando Resend API falha", async () => {
    listConnectedDomainsMock.mockImplementation(async () => [
      connectedDomain({
        teamId: "team-1",
        resendDomainId: "dom-1",
      }),
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

    expect(result.isValid).toBe(false)
    expect(result.result.errors).toBe(1)
    expect(result.errorMessages[0]).toContain("1 erro(s) ao reconciliar")
    expect(syncFromResendDomainMock).not.toHaveBeenCalled()
  })

  it("retorna inválido quando há erros parciais mas também sincronizações", async () => {
    listConnectedDomainsMock.mockImplementation(async () => [
      connectedDomain({
        teamId: "team-1",
        resendDomainId: "dom-1",
        resendDomainName: "ok.example.com",
      }),
      connectedDomain({
        teamId: "team-2",
        resendDomainId: "dom-2",
        resendDomainName: "fail.example.com",
      }),
    ])
    fetchDomainMock.mockImplementation(async (domainId) => {
      if (domainId === "dom-2") {
        return { data: null, error: "rate limit" }
      }
      return {
        data: {
          id: domainId,
          status: "partially_failed",
          region: "sa-east-1",
          openTracking: true,
          clickTracking: true,
        },
        error: null,
      }
    })

    const useCase = new ReconcileResendDomainStatusUseCase(
      buildRepository(),
      fetchDomainMock
    )
    const result = await useCase.execute()

    expect(result.isValid).toBe(false)
    expect(result.result.synced).toBe(1)
    expect(result.result.errors).toBe(1)
    expect(result.successMessages[0]).toContain("1 domínio(s) reconciliado(s)")
  })
})
