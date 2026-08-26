import { beforeEach, describe, expect, it, mock } from "bun:test"
import type {
  ConnectedResendDomainRow,
  IEmailTeamDomainEventRepository,
  ResendDomainSnapshot,
} from "@/app/api/infra/data/repositories/emailTeamDomainEvent/EmailTeamDomainEventRepository"
import {
  ReconcileResendDomainStatusUseCase,
  type ResendDomainFetcher,
  type ResendDomainTrackingUpdater,
} from "./ReconcileResendDomainStatusUseCase"

function connectedDomain(
  overrides: Partial<ConnectedResendDomainRow> &
    Pick<ConnectedResendDomainRow, "teamId" | "resendDomainId">
): ConnectedResendDomainRow {
  return {
    resendDomainName: "example.com",
    resendDomainStatus: "verified",
    resendDomainRegion: "sa-east-1",
    // Política vigente (RESEND_TRACKING_POLICY): abertura ON, clique OFF.
    resendOpenTracking: true,
    resendClickTracking: false,
    resendSendingDnsVerified: false,
    ...overrides,
  }
}

const listConnectedDomainsMock = mock(async (): Promise<ConnectedResendDomainRow[]> => [])
const syncFromResendDomainMock = mock(
  async (_teamId: string, _domain: ResendDomainSnapshot, _occurredAt: Date) => ({
    status: "partially_failed",
    region: "sa-east-1",
    openTracking: true,
    clickTracking: false,
    trackingSubdomain: "links",
  })
)
const fetchDomainMock = mock<ResendDomainFetcher>(async () => ({
  data: {
    id: "dom-1",
    status: "partially_failed",
    region: "sa-east-1",
    openTracking: true,
    clickTracking: false,
  },
  error: null,
}))
const updateTrackingMock = mock<ResendDomainTrackingUpdater>(async () => ({ error: null }))

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
    updateTrackingMock.mockClear()
    listConnectedDomainsMock.mockImplementation(async () => [])
    updateTrackingMock.mockImplementation(async () => ({ error: null }))
    fetchDomainMock.mockImplementation(async () => ({
      data: {
        id: "dom-1",
        status: "partially_failed",
        region: "sa-east-1",
        openTracking: true,
        clickTracking: false,
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

    const useCase = new ReconcileResendDomainStatusUseCase({
      domainEvents: buildRepository(),
      fetchDomain: fetchDomainMock,
      updateTracking: updateTrackingMock,
    })
    const result = await useCase.execute()

    expect(result.isValid).toBe(true)
    expect(result.result.synced).toBe(1)
    expect(result.result.inSync).toBe(0)
    expect(syncFromResendDomainMock).toHaveBeenCalledTimes(1)
  })

  it("não sincroniza quando o snapshot está alinhado e a resposta não traz registros", async () => {
    // O `fetchDomainMock` padrão não devolve `records`, então a derivação do DNS
    // de envio responde `undefined` e sai da comparação. Este caso cobre só o
    // alinhamento de status/região/tracking — o caso com registros está abaixo.
    listConnectedDomainsMock.mockImplementation(async () => [
      connectedDomain({
        teamId: "team-1",
        resendDomainId: "dom-1",
        resendDomainStatus: "partially_failed",
      }),
    ])

    const useCase = new ReconcileResendDomainStatusUseCase({
      domainEvents: buildRepository(),
      fetchDomain: fetchDomainMock,
      updateTracking: updateTrackingMock,
    })
    const result = await useCase.execute()

    expect(result.result.synced).toBe(0)
    expect(result.result.inSync).toBe(1)
    expect(syncFromResendDomainMock).not.toHaveBeenCalled()
  })

  it("caso Liber: status igual, flag do DNS de envio divergente → sincroniza", async () => {
    // `partially_failed` porque só o CNAME de tracking falhou. Status, região e
    // flags nunca mudam, então o early-out dizia "em dia" e o cron nunca
    // derivava `resendSendingDnsVerified` — o gate ficava travado até alguém
    // clicar "Verificar DNS" na mão. É o cenário que motivou a mudança.
    listConnectedDomainsMock.mockImplementation(async () => [
      connectedDomain({
        teamId: "team-1",
        resendDomainId: "dom-1",
        resendDomainStatus: "partially_failed",
        resendSendingDnsVerified: false,
      }),
    ])
    fetchDomainMock.mockImplementation(async () => ({
      data: {
        id: "dom-1",
        status: "partially_failed",
        region: "sa-east-1",
        openTracking: true,
        clickTracking: false,
        records: [
          { record: "DKIM", status: "verified" },
          { record: "SPF", status: "verified" },
          { record: "Tracking", status: "failed" },
        ],
      },
      error: null,
    }))

    const useCase = new ReconcileResendDomainStatusUseCase({
      domainEvents: buildRepository(),
      fetchDomain: fetchDomainMock,
      updateTracking: updateTrackingMock,
    })
    const result = await useCase.execute()

    expect(result.result.synced).toBe(1)
    expect(result.result.inSync).toBe(0)
    expect(syncFromResendDomainMock).toHaveBeenCalledTimes(1)
  })

  it("DKIM que cai sem mexer no status agregado força sincronização", async () => {
    // O lado fail-open do mesmo early-out: o flag está `true`, o DKIM quebrou, e
    // sem comparar registros o cron deixaria o gate liberando disparo sem
    // assinatura.
    listConnectedDomainsMock.mockImplementation(async () => [
      connectedDomain({
        teamId: "team-1",
        resendDomainId: "dom-1",
        resendDomainStatus: "partially_failed",
        resendSendingDnsVerified: true,
      }),
    ])
    fetchDomainMock.mockImplementation(async () => ({
      data: {
        id: "dom-1",
        status: "partially_failed",
        region: "sa-east-1",
        openTracking: true,
        clickTracking: false,
        records: [
          { record: "DKIM", status: "failed" },
          { record: "SPF", status: "verified" },
        ],
      },
      error: null,
    }))

    const useCase = new ReconcileResendDomainStatusUseCase({
      domainEvents: buildRepository(),
      fetchDomain: fetchDomainMock,
      updateTracking: updateTrackingMock,
    })
    const result = await useCase.execute()

    expect(result.result.synced).toBe(1)
    expect(syncFromResendDomainMock).toHaveBeenCalledTimes(1)
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

    const useCase = new ReconcileResendDomainStatusUseCase({
      domainEvents: buildRepository(),
      fetchDomain: fetchDomainMock,
      updateTracking: updateTrackingMock,
    })
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

    const useCase = new ReconcileResendDomainStatusUseCase({
      domainEvents: buildRepository(),
      fetchDomain: fetchDomainMock,
      updateTracking: updateTrackingMock,
    })
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
          clickTracking: false,
        },
        error: null,
      }
    })

    const useCase = new ReconcileResendDomainStatusUseCase({
      domainEvents: buildRepository(),
      fetchDomain: fetchDomainMock,
      updateTracking: updateTrackingMock,
    })
    const result = await useCase.execute()

    expect(result.isValid).toBe(false)
    expect(result.result.synced).toBe(1)
    expect(result.result.errors).toBe(1)
    expect(result.successMessages[0]).toContain("1 domínio(s) reconciliado(s)")
  })

  /**
   * T-C3.1 — o caso C6 da auditoria: abertura desligada apaga as aberturas
   * daquele domínio do funil, e ninguém percebe porque o número simplesmente
   * fica menor.
   */
  it("T-C3.1 — abertura OFF no provedor é religada e o clique é desligado", async () => {
    listConnectedDomainsMock.mockImplementation(async () => [
      connectedDomain({
        teamId: "team-1",
        resendDomainId: "dom-1",
        resendDomainStatus: "partially_failed",
        resendOpenTracking: false,
      }),
    ])
    fetchDomainMock.mockImplementation(async () => ({
      data: {
        id: "dom-1",
        status: "partially_failed",
        region: "sa-east-1",
        openTracking: false,
        clickTracking: true,
      },
      error: null,
    }))

    const useCase = new ReconcileResendDomainStatusUseCase({
      domainEvents: buildRepository(),
      fetchDomain: fetchDomainMock,
      updateTracking: updateTrackingMock,
    })
    const result = await useCase.execute()

    expect(updateTrackingMock).toHaveBeenCalledTimes(1)
    expect(updateTrackingMock.mock.calls[0][0]).toEqual({
      domainId: "dom-1",
      openTracking: true,
      clickTracking: false,
    })
    expect(result.result.trackingFixed).toBe(1)

    // O snapshot persistido tem que refletir o que passou a valer, não o que o
    // provedor devolveu antes da correção.
    const syncedSnapshot = syncFromResendDomainMock.mock.calls[0]![1]
    expect(syncedSnapshot.openTracking).toBe(true)
    expect(syncedSnapshot.clickTracking).toBe(false)
  })

  it("T-C3.1b — domínio já na política não recebe update (idempotente)", async () => {
    listConnectedDomainsMock.mockImplementation(async () => [
      connectedDomain({
        teamId: "team-1",
        resendDomainId: "dom-1",
        resendDomainStatus: "partially_failed",
      }),
    ])

    const useCase = new ReconcileResendDomainStatusUseCase({
      domainEvents: buildRepository(),
      fetchDomain: fetchDomainMock,
      updateTracking: updateTrackingMock,
    })
    const result = await useCase.execute()

    expect(updateTrackingMock).not.toHaveBeenCalled()
    expect(result.result.trackingFixed).toBe(0)
    expect(result.result.inSync).toBe(1)
  })

  it("T-C3.1c — falha ao aplicar a política não derruba a reconciliação de status", async () => {
    listConnectedDomainsMock.mockImplementation(async () => [
      connectedDomain({
        teamId: "team-1",
        resendDomainId: "dom-1",
        resendDomainStatus: "verified",
        resendOpenTracking: false,
      }),
    ])
    fetchDomainMock.mockImplementation(async () => ({
      data: {
        id: "dom-1",
        status: "partially_failed",
        region: "sa-east-1",
        openTracking: false,
        clickTracking: false,
      },
      error: null,
    }))
    updateTrackingMock.mockImplementation(async () => ({ error: "rate limit" }))

    const useCase = new ReconcileResendDomainStatusUseCase({
      domainEvents: buildRepository(),
      fetchDomain: fetchDomainMock,
      updateTracking: updateTrackingMock,
    })
    const result = await useCase.execute()

    expect(result.result.trackingErrors).toBe(1)
    expect(result.result.trackingFixed).toBe(0)
    expect(syncFromResendDomainMock).toHaveBeenCalledTimes(1)

    // Revisão do PR #1073: sem isto o `withCronAudit` marcava sucesso e não
    // disparava alerta, enquanto o domínio seguia com abertura desligada — o
    // monitoramento afirmando "tudo certo" sobre a cegueira que este estágio
    // existe para acabar.
    expect(result.isValid).toBe(false)
    expect(result.errorMessages[0]).toContain("política de tracking")

    // Não pode gravar `openTracking: true` sem o provedor ter aceitado: seria
    // trocar uma cegueira por uma mentira.
    expect(syncFromResendDomainMock.mock.calls[0]![1].openTracking).toBe(false)
  })
})
