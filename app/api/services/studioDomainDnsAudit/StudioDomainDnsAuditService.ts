import { createHash } from "node:crypto"
import type { IVercelDomainsGateway } from "../vercelDomains/IVercelDomainsGateway"
import { selectRecommendedVercelCname } from "../vercelDomains/resolveRecommendedVercelCname"
import type { IStudioDomainDnsAuditService } from "./IStudioDomainDnsAuditService"
import type {
  StudioDomainDnsAuditReasonCode,
  StudioDomainDnsAuditResult,
  StudioDomainDnsAuditStatus,
} from "./StudioDomainDnsAuditTypes"

type AuditDecision = {
  status: StudioDomainDnsAuditStatus
  reasonCode: StudioDomainDnsAuditReasonCode
  reason: string
  misconfigured: boolean
  recommendedCNAME: string | null
}

export class StudioDomainDnsAuditService implements IStudioDomainDnsAuditService {
  constructor(private readonly gateway: IVercelDomainsGateway) {}

  async audit(hostname: string): Promise<StudioDomainDnsAuditResult> {
    if (!this.gateway.isConfigured()) {
      return this.createResult(hostname, {
        status: "inconclusive",
        reasonCode: "vercel_not_configured",
        reason: "A integração de domínios da Vercel não está configurada.",
        misconfigured: false,
        recommendedCNAME: null,
      })
    }

    const projectDomain = await this.gateway.getProjectDomain(hostname)
    if (!projectDomain.ok) {
      return this.createResult(hostname, projectDomain.status === 404
        ? {
            status: "failed",
            reasonCode: "domain_not_found",
            reason: "O domínio não está registrado no projeto da Vercel.",
            misconfigured: false,
            recommendedCNAME: null,
          }
        : {
            status: "inconclusive",
            reasonCode: "project_domain_query_failed",
            reason: "Não foi possível consultar o domínio no projeto da Vercel.",
            misconfigured: false,
            recommendedCNAME: null,
          })
    }

    if (!projectDomain.data.verified) {
      return this.createResult(hostname, {
        status: "pending",
        reasonCode: "domain_ownership_pending",
        reason: "A confirmação de propriedade do domínio ainda está pendente na Vercel.",
        misconfigured: false,
        recommendedCNAME: null,
      })
    }

    const domainConfig = await this.gateway.getDomainConfig(hostname)
    if (!domainConfig.ok) {
      return this.createResult(hostname, domainConfig.status === 404
        ? {
            status: "failed",
            reasonCode: "domain_not_found",
            reason: "O domínio não está registrado na configuração da Vercel.",
            misconfigured: false,
            recommendedCNAME: null,
          }
        : {
            status: "inconclusive",
            reasonCode: "domain_config_query_failed",
            reason: "Não foi possível consultar a configuração DNS na Vercel.",
            misconfigured: false,
            recommendedCNAME: null,
          })
    }

    const recommendedCNAME = selectRecommendedVercelCname(domainConfig.data)
    if (domainConfig.data.misconfigured) {
      return this.createResult(hostname, {
        status: "pending",
        reasonCode: "dns_misconfigured",
        reason: "O DNS ainda não está apontando corretamente para a Vercel.",
        misconfigured: true,
        recommendedCNAME,
      })
    }

    return this.createResult(hostname, {
      status: "verified",
      reasonCode: "verified",
      reason: "O domínio está verificado e o DNS aponta corretamente para a Vercel.",
      misconfigured: false,
      recommendedCNAME,
    })
  }

  private createResult(hostname: string, decision: AuditDecision): StudioDomainDnsAuditResult {
    const fingerprint = createHash("sha256")
      .update(JSON.stringify({
        hostname,
        status: decision.status,
        reasonCode: decision.reasonCode,
        misconfigured: decision.misconfigured,
        recommendedCNAME: decision.recommendedCNAME,
      }))
      .digest("hex")

    return { hostname, ...decision, fingerprint }
  }
}
