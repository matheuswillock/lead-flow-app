import { beforeEach, describe, expect, it, mock } from "bun:test"
import type { TeamAccess, TeamAccessResult } from "@/app/api/v1/utils/teamAccess"

const access = { teamId: "team-1", isMaster: true, teamMember: { role: "manager" } } as TeamAccess
const getTeamAccessMock = mock(async (): Promise<TeamAccessResult> => ({ access }))
const emailSettingsMock = mock(async () => ({
  isValid: true,
  successMessages: [],
  errorMessages: [],
  result: { resendDomainName: "mail.acme.com", resendDomainStatus: "verified" },
}))
const recordsMock = mock(async () => ({
  isValid: true,
  successMessages: [],
  errorMessages: [],
  result: {
    studioDomain: {
      dnsAuditStatus: "pending",
      dnsMisconfigured: true,
      dnsReasonCode: "dns_misconfigured",
      dnsReason: "CNAME incorreto",
      recommendedCNAME: "target.vercel-dns.com",
      lastDnsAuditAt: new Date("2026-10-19T11:00:00.000Z"),
      lastDnsAttemptAt: new Date("2026-10-19T11:01:00.000Z"),
    },
  },
}))

mock.module("next/server", () => ({
  NextResponse: { json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }) },
}))
mock.module("@/app/api/v1/utils/teamAccess", () => ({ getTeamAccess: getTeamAccessMock }))
mock.module("@/app/api/useCases/email/EmailTeamSettingsUseCase", () => ({
  EmailTeamSettingsUseCase: class { get = emailSettingsMock },
}))
mock.module("@/app/api/useCases/email/TeamStudioDomainUseCase", () => ({
  TeamStudioDomainUseCase: class { getRecordsForEmailDomain = recordsMock },
}))
mock.module("@/lib/cache/invalidation", () => ({
  invalidateTeamStudioDomainCache: () => undefined,
}))

const { GET } = await import("./route")

function makeRequest() {
  return { headers: { get: () => null } } as unknown as import("next/server").NextRequest
}

describe("GET /api/v1/email/settings/studio-domain/records", () => {
  beforeEach(() => {
    getTeamAccessMock.mockClear()
    emailSettingsMock.mockClear()
    recordsMock.mockClear()
    getTeamAccessMock.mockResolvedValue({ access })
  })

  it("propaga o status de autorização resolvido por getTeamAccess", async () => {
    getTeamAccessMock.mockResolvedValueOnce({
      error: { isValid: false, successMessages: [], errorMessages: ["Acesso negado"], result: null },
      status: 403,
    })

    const response = await GET(makeRequest()) as unknown as { status: number }

    expect(response.status).toBe(403)
    expect(recordsMock).not.toHaveBeenCalled()
  })

  it("retorna os dados persistidos da auditoria DNS para o time autenticado", async () => {
    const response = await GET(makeRequest()) as unknown as {
      status: number
      body: { result: { studioDomain: { dnsAuditStatus: string; recommendedCNAME: string } } }
    }

    expect(response.status).toBe(200)
    expect(response.body.result.studioDomain).toMatchObject({
      dnsAuditStatus: "pending",
      recommendedCNAME: "target.vercel-dns.com",
    })
    expect(recordsMock).toHaveBeenCalledWith(access, {
      name: "mail.acme.com",
      status: "verified",
    })
  })
})
