import { Output } from "@/lib/output"
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"
import { isManagerLikeRole } from "@/lib/roles"
import { checkFormDomainVerification } from "@/lib/public-forms/form-domain-verification"
import { buildFormDomainDnsRecords } from "@/lib/public-forms/form-domain-dns-records"
import { studioHostnameFromEmailDomain } from "@/lib/public-studio/studio-domain-hostname"
import { hasLandingPageManagementAccess } from "@/app/api/useCases/landingPages/landingPageFeatureAccess"
import { vercelDomainsGateway } from "@/app/api/services/vercelDomains/VercelDomainsGateway"
import type { IVercelDomainsGateway } from "@/app/api/services/vercelDomains/IVercelDomainsGateway"
import {
  teamStudioDomainRepository,
} from "@/app/api/infra/data/repositories/teamStudioDomain/TeamStudioDomainRepository"
import type {
  ITeamStudioDomainRepository,
  TeamStudioDomainRecord,
} from "@/app/api/infra/data/repositories/teamStudioDomain/ITeamStudioDomainRepository"

type StudioDomainDependencies = {
  repository?: ITeamStudioDomainRepository
  vercelGateway?: IVercelDomainsGateway
  invalidateCache?: (input: { hostname: string }) => void
}

type EmailDomainContext = {
  name: string | null | undefined
  status: string | null | undefined
}

const MAX_TRACKING_SCRIPT_LENGTH = 20000
const ALLOWED_TRACKING_TAGS = /^(?:\s|<\/?(?:script|meta|noscript|link|!--)[^>]*>)*$/i

function normalizeTrackingScript(value: unknown, label: string): string | null {
  if (value === null || value === undefined || value === "") return null
  if (typeof value !== "string" || value.length > MAX_TRACKING_SCRIPT_LENGTH) {
    throw new Error(`${label} excede o limite permitido`)
  }
  if (/<\s*(?:iframe|object|embed|form)|\bon\w+\s*=|javascript:/i.test(value) || !ALLOWED_TRACKING_TAGS.test(value)) {
    throw new Error(`${label} aceita apenas scripts, metatags e noscript válidos`)
  }
  return value.trim() || null
}

function canManage(access: TeamAccess) {
  return access.isMaster || isManagerLikeRole(access.teamMember.role)
}

function accessDeniedOutput(): Output {
  return new Output(false, [], ["Acesso negado"], null)
}

function toDto(domain: TeamStudioDomainRecord) {
  return {
    id: domain.id,
    teamId: domain.teamId,
    hostname: domain.hostname,
    status: domain.status,
    vercelDomainId: domain.vercelDomainId,
    verifiedAt: domain.verifiedAt,
    lastCheckedAt: domain.lastCheckedAt,
    createdAt: domain.createdAt,
    updatedAt: domain.updatedAt,
    tracking: {
      headScripts: domain.headScripts,
      bodyStartScripts: domain.bodyStartScripts,
      bodyEndScripts: domain.bodyEndScripts,
    },
  }
}

export class TeamStudioDomainUseCase {
  private readonly repository: ITeamStudioDomainRepository
  private readonly vercelGateway: IVercelDomainsGateway
  private readonly invalidateCache: (input: { hostname: string }) => void

  constructor(dependencies: StudioDomainDependencies = {}) {
    this.repository = dependencies.repository ?? teamStudioDomainRepository
    this.vercelGateway = dependencies.vercelGateway ?? vercelDomainsGateway
    this.invalidateCache = dependencies.invalidateCache ?? (() => undefined)
  }

  async get(access: TeamAccess, emailDomainName: string | null | undefined): Promise<Output> {
    if (!canManage(access)) return accessDeniedOutput()
    const domain = await this.repository.findByTeamId(access.teamId)
    const hostname = studioHostnameFromEmailDomain(emailDomainName)
    return new Output(true, [], [], {
      studioDomain: domain ? toDto(domain) : null,
      suggestedHostname: hostname,
    })
  }

  async getForEmailDomain(access: TeamAccess, emailDomain: EmailDomainContext): Promise<Output> {
    if (!canManage(access)) return accessDeniedOutput()
    if (emailDomain.status !== "verified" || !emailDomain.name) return this.get(access, null)

    const ensureOutput = await this.ensureForVerifiedEmailDomain(access.teamId, emailDomain.name)
    return ensureOutput.isValid ? this.get(access, emailDomain.name) : ensureOutput
  }

  async ensureForVerifiedEmailDomain(teamId: string, emailDomainName: string): Promise<Output> {
    const hostname = studioHostnameFromEmailDomain(emailDomainName)
    if (!hostname) return new Output(false, [], ["Domínio de envio inválido"], null)

    const existing = await this.repository.findByTeamId(teamId)
    if (existing) {
      if (existing.hostname !== hostname) {
        return new Output(false, [], ["O domínio studio existente precisa ser desconectado antes de trocar o domínio de envio."], null)
      }
      return new Output(true, [], [], { studioDomain: toDto(existing) })
    }

    if (!this.vercelGateway.isConfigured()) {
      return new Output(false, [], ["Integração de domínio não configurada."], null)
    }

    const registration = await this.vercelGateway.addProjectDomain(hostname)
    if (!registration.ok) {
      return new Output(false, [], ["Não foi possível registrar o subdomínio studio agora."], null)
    }

    const domain = await this.repository.create({
      teamId,
      hostname,
      vercelDomainId: registration.data.name ?? hostname,
    })
    this.invalidateCache({ hostname })

    return new Output(true, ["Subdomínio studio registrado. Crie o CNAME para ativá-lo."], [], {
      studioDomain: toDto(domain),
      records: buildFormDomainDnsRecords({
        hostname,
        apexName: registration.data.apexName,
        verificationChallenges: registration.data.verification,
        verified: false,
      }),
    })
  }

  async getRecords(access: TeamAccess, emailDomainName: string | null | undefined): Promise<Output> {
    if (!canManage(access)) return accessDeniedOutput()
    const domain = await this.repository.findByTeamId(access.teamId)
    const hostname = domain?.hostname ?? studioHostnameFromEmailDomain(emailDomainName)
    if (!hostname) return this.get(access, emailDomainName)

    const projectDomain = this.vercelGateway.isConfigured()
      ? await this.vercelGateway.getProjectDomain(hostname)
      : null

    return new Output(true, [], [], {
      studioDomain: domain ? toDto(domain) : null,
      suggestedHostname: hostname,
      records: buildFormDomainDnsRecords({
        hostname,
        apexName: projectDomain?.ok ? projectDomain.data.apexName : null,
        verificationChallenges: projectDomain?.ok ? projectDomain.data.verification : null,
        verified: domain?.status === "verified",
      }),
    })
  }

  async getRecordsForEmailDomain(access: TeamAccess, emailDomain: EmailDomainContext): Promise<Output> {
    if (!canManage(access)) return accessDeniedOutput()
    if (emailDomain.status !== "verified" || !emailDomain.name) return this.getRecords(access, null)

    const ensureOutput = await this.ensureForVerifiedEmailDomain(access.teamId, emailDomain.name)
    return ensureOutput.isValid ? this.getRecords(access, emailDomain.name) : ensureOutput
  }

  async verify(access: TeamAccess): Promise<Output> {
    if (!canManage(access)) return accessDeniedOutput()
    const domain = await this.repository.findByTeamId(access.teamId)
    if (!domain) return new Output(false, [], ["Nenhum subdomínio studio conectado"], null)
    if (!this.vercelGateway.isConfigured()) return new Output(false, [], ["Integração de domínio não configurada."], null)

    const outcome = await checkFormDomainVerification(this.vercelGateway, domain.hostname)
    const checkedAt = new Date()
    const updated = await this.repository.saveCheckResult(domain.id, {
      status: outcome.status === "verified" ? "verified" : "failed",
      lastCheckedAt: checkedAt,
      verifiedAt: outcome.status === "verified" ? domain.verifiedAt ?? checkedAt : null,
    })
    this.invalidateCache({ hostname: domain.hostname })

    return new Output(true, [outcome.reason], [], { studioDomain: toDto(updated) })
  }

  async updateTracking(access: TeamAccess, input: { headScripts?: unknown; bodyStartScripts?: unknown; bodyEndScripts?: unknown }): Promise<Output> {
    if (!canManage(access)) return accessDeniedOutput()
    if (!(await hasLandingPageManagementAccess(access))) {
      return new Output(false, [], ["O rastreamento de landing pages não está disponível para esta conta"], null)
    }
    try {
      if (!this.repository.updateTracking) return new Output(false, [], ["Configuração de rastreamento indisponível"], null)
      const domain = await this.repository.updateTracking(access.teamId, {
        headScripts: normalizeTrackingScript(input.headScripts, "Código no head"),
        bodyStartScripts: normalizeTrackingScript(input.bodyStartScripts, "Código no início do body"),
        bodyEndScripts: normalizeTrackingScript(input.bodyEndScripts, "Código no fim do body"),
      })
      return domain
        ? new Output(true, ["Códigos de rastreamento salvos"], [], { studioDomain: toDto(domain) })
        : new Output(false, [], ["Conecte o domínio studio antes de adicionar códigos"], null)
    } catch (error) {
      return new Output(false, [], [error instanceof Error ? error.message : "Código de rastreamento inválido"], null)
    }
  }

  async disconnectForTeam(teamId: string): Promise<void> {
    const domain = await this.repository.findByTeamId(teamId)
    if (!domain) return
    if (this.vercelGateway.isConfigured()) {
      const removal = await this.vercelGateway.removeProjectDomain(domain.hostname)
      if (!removal.ok && removal.status !== 404) {
        throw new Error(removal.errorMessage)
      }
    }
    await this.repository.deleteById(domain.id)
    this.invalidateCache({ hostname: domain.hostname })
  }
}

export const teamStudioDomainUseCase = new TeamStudioDomainUseCase()
