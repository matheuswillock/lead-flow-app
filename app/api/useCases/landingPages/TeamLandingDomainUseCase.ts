import { Output } from "@/lib/output"
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"
import { isManagerLikeRole } from "@/lib/roles"
import { validateFormDomainHostname } from "@/lib/public-forms/form-domain-hostname"
import { checkFormDomainVerification } from "@/lib/public-forms/form-domain-verification"
import { buildFormDomainDnsRecords } from "@/lib/public-forms/form-domain-dns-records"
import { vercelDomainsGateway } from "@/app/api/services/vercelDomains/VercelDomainsGateway"
import { teamLandingDomainRepository } from "@/app/api/infra/data/repositories/teamLandingDomain/TeamLandingDomainRepository"

export class TeamLandingDomainUseCase {
  async get(access: TeamAccess) {
    if (!isManagerLikeRole(access.teamMember.role) && !access.isMaster) return new Output(false, [], ["Acesso negado"], null)
    return new Output(true, [], [], { landingDomain: await teamLandingDomainRepository.findByTeamId(access.teamId) })
  }

  async connect(access: TeamAccess, rawHostname: string) {
    if (!isManagerLikeRole(access.teamMember.role) && !access.isMaster) return new Output(false, [], ["Acesso negado"], null)
    const validation = validateFormDomainHostname(rawHostname)
    if (!validation.ok) return new Output(false, [], [validation.error.replace("domínio de formulários", "domínio de landing")], null)
    if (!validation.hostname.startsWith("cotacao.")) {
      return new Output(false, [], ["O domínio da landing deve usar o subdomínio cotacao."], null)
    }
    if (await teamLandingDomainRepository.findByTeamId(access.teamId)) return new Output(false, [], ["Este time já tem um domínio de landing conectado."], null)
    if (await teamLandingDomainRepository.findByHostname(validation.hostname)) return new Output(false, [], ["Este subdomínio já está em uso."], null)
    if (!vercelDomainsGateway.isConfigured()) return new Output(false, [], ["Integração de domínio não configurada."], null)
    const registration = await vercelDomainsGateway.addProjectDomain(validation.hostname)
    if (!registration.ok) return new Output(false, [], ["Não foi possível registrar o subdomínio agora."], null)
    const domain = await teamLandingDomainRepository.create({ teamId: access.teamId, hostname: validation.hostname, vercelDomainId: registration.data.name ?? validation.hostname })
    const records = buildFormDomainDnsRecords({
      hostname: validation.hostname,
      apexName: registration.data.apexName,
      verificationChallenges: registration.data.verification,
    })
    return new Output(true, ["Domínio conectado. Crie o registro DNS para ativar."], [], { landingDomain: domain, records })
  }

  async verify(access: TeamAccess) {
    if (!isManagerLikeRole(access.teamMember.role) && !access.isMaster) return new Output(false, [], ["Acesso negado"], null)
    const domain = await teamLandingDomainRepository.findByTeamId(access.teamId)
    if (!domain) return new Output(false, [], ["Nenhum domínio de landing conectado"], null)
    const outcome = await checkFormDomainVerification(vercelDomainsGateway, domain.hostname)
    const checkedAt = new Date()
    const updated = await teamLandingDomainRepository.saveCheckResult(domain.id, { status: outcome.status === "verified" ? "verified" : "failed", lastCheckedAt: checkedAt, verifiedAt: outcome.status === "verified" ? domain.verifiedAt ?? checkedAt : null })
    return new Output(true, [outcome.reason], [], { landingDomain: updated })
  }

  async disconnect(access: TeamAccess) {
    if (!isManagerLikeRole(access.teamMember.role) && !access.isMaster) return new Output(false, [], ["Acesso negado"], null)
    const domain = await teamLandingDomainRepository.findByTeamId(access.teamId)
    if (!domain) return new Output(false, [], ["Nenhum domínio de landing conectado"], null)
    if (vercelDomainsGateway.isConfigured()) await vercelDomainsGateway.removeProjectDomain(domain.hostname)
    await teamLandingDomainRepository.deleteById(domain.id)
    return new Output(true, ["Domínio de landing removido"], [], null)
  }
}

export const teamLandingDomainUseCase = new TeamLandingDomainUseCase()
