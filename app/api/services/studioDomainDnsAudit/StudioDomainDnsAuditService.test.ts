import { describe, expect, it } from "bun:test"
import type {
  IVercelDomainsGateway,
  VercelDomainConfig,
  VercelDomainsGatewayResult,
  VercelProjectDomain,
} from "../vercelDomains/IVercelDomainsGateway"
import { StudioDomainDnsAuditService } from "./StudioDomainDnsAuditService"

const hostname = "studio.example.com"

function makeGateway(
  projectDomain: VercelDomainsGatewayResult<VercelProjectDomain>,
  domainConfig: VercelDomainsGatewayResult<VercelDomainConfig> = {
    ok: true,
    data: { misconfigured: false },
  },
): IVercelDomainsGateway {
  return {
    isConfigured: () => true,
    getProjectDomain: async () => projectDomain,
    getDomainConfig: async () => domainConfig,
    addProjectDomain: async () => ({ ok: true, data: { name: hostname, verified: false } }),
    removeProjectDomain: async () => ({ ok: true, data: { removed: true } }),
  }
}

describe("StudioDomainDnsAuditService", () => {
  it("retorna verified quando propriedade e DNS estão confirmados", async () => {
    const result = await new StudioDomainDnsAuditService(
      makeGateway({ ok: true, data: { name: hostname, verified: true } }),
    ).audit(hostname)

    expect(result.status).toBe("verified")
    expect(result.reasonCode).toBe("verified")
    expect(result.fingerprint).toMatch(/^[a-f0-9]{64}$/)
  })

  it("retorna pending para domínio ainda não verificado", async () => {
    const result = await new StudioDomainDnsAuditService(
      makeGateway({ ok: true, data: { name: hostname, verified: false } }),
    ).audit(hostname)

    expect(result.status).toBe("pending")
    expect(result.reasonCode).toBe("domain_ownership_pending")
    expect(result.recommendedCNAME).toBeNull()
  })

  it("retorna pending para DNS misconfigured e escolhe CNAME pelo menor rank", async () => {
    const result = await new StudioDomainDnsAuditService(
      makeGateway(
        { ok: true, data: { name: hostname, verified: true } },
        {
          ok: true,
          data: {
            misconfigured: true,
            recommendedCNAME: [
              { rank: 20, value: "late.vercel-dns.com" },
              { rank: 2, value: "preferred.vercel-dns.com" },
            ],
          },
        },
      ),
    ).audit(hostname)

    expect(result.status).toBe("pending")
    expect(result.reasonCode).toBe("dns_misconfigured")
    expect(result.recommendedCNAME).toBe("preferred.vercel-dns.com")
  })

  it("retorna failed para 404 no projeto", async () => {
    const result = await new StudioDomainDnsAuditService(
      makeGateway({ ok: false, status: 404, errorMessage: "not found" }),
    ).audit(hostname)

    expect(result.status).toBe("failed")
    expect(result.reasonCode).toBe("domain_not_found")
  })

  it("retorna inconclusive para falha de transporte na primeira consulta", async () => {
    const result = await new StudioDomainDnsAuditService(
      makeGateway({ ok: false, status: 500, errorMessage: "internal error" }),
    ).audit(hostname)

    expect(result.status).toBe("inconclusive")
    expect(result.reasonCode).toBe("project_domain_query_failed")
  })

  it("retorna inconclusive para falha na segunda consulta", async () => {
    const result = await new StudioDomainDnsAuditService(
      makeGateway(
        { ok: true, data: { name: hostname, verified: true } },
        { ok: false, status: 429, errorMessage: "rate limited" },
      ),
    ).audit(hostname)

    expect(result.status).toBe("inconclusive")
    expect(result.reasonCode).toBe("domain_config_query_failed")
  })

  it("retorna inconclusive quando a integração está sem configuração", async () => {
    const gateway = makeGateway({ ok: true, data: { name: hostname, verified: true } })
    gateway.isConfigured = () => false

    const result = await new StudioDomainDnsAuditService(gateway).audit(hostname)

    expect(result.status).toBe("inconclusive")
    expect(result.reasonCode).toBe("vercel_not_configured")
  })

  it("mantém fingerprint determinístico para a mesma decisão", async () => {
    const service = new StudioDomainDnsAuditService(
      makeGateway({ ok: true, data: { name: hostname, verified: true } }),
    )

    const first = await service.audit(hostname)
    const second = await service.audit(hostname)

    expect(first.fingerprint).toBe(second.fingerprint)
  })
})
