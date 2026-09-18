import { Output } from "@/lib/output"
import type { TeamAccess as TeamContext } from "@/app/api/v1/utils/teamAccess"
import type {
  ITeamFormDomainRepository,
  TeamFormDomainRecord,
} from "@/app/api/infra/data/repositories/teamFormDomain/ITeamFormDomainRepository"
import { teamFormDomainRepository } from "@/app/api/infra/data/repositories/teamFormDomain/TeamFormDomainRepository"
import type { IVercelDomainsGateway } from "@/app/api/services/vercelDomains/IVercelDomainsGateway"
import { vercelDomainsGateway } from "@/app/api/services/vercelDomains/VercelDomainsGateway"
import { validateFormDomainHostname } from "@/lib/public-forms/form-domain-hostname"
import { checkFormDomainVerification } from "@/lib/public-forms/form-domain-verification"
import { buildFormDomainDnsRecords } from "@/lib/public-forms/form-domain-dns-records"
import type { CustomDomainDnsRecord } from "@/lib/email/custom-domain-dns-instructions"
import { invalidateTeamFormDomainCache } from "@/lib/cache/invalidation"

const NOT_CONFIGURED_MESSAGE =
  "Integração de domínio de formulários não configurada nesta instalação. Fale com o suporte do Corretor Studio."

export type TeamFormDomainDto = {
  hostname: string
  status: TeamFormDomainRecord["status"]
  verifiedAt: Date | null
  lastCheckedAt: Date | null
  createdAt: Date
}

export type TeamFormDomainDependencies = {
  repository?: ITeamFormDomainRepository
  vercelGateway?: IVercelDomainsGateway
  invalidateCache?: (input: { hostname: string }) => void
  now?: () => Date
}

function toDto(record: TeamFormDomainRecord): TeamFormDomainDto {
  return {
    hostname: record.hostname,
    status: record.status,
    verifiedAt: record.verifiedAt,
    lastCheckedAt: record.lastCheckedAt,
    createdAt: record.createdAt,
  }
}

/**
 * Domínio próprio do time para servir formulários públicos (Frente C —
 * Deliverability). Orquestra Vercel (gateway) + persistência (repository) e
 * invalida o cache de tenancy por hostname a cada mutação — o serving em
 * `app/forms/[publicId]` depende desse cache.
 */
export class TeamFormDomainUseCase {
  private readonly repository: ITeamFormDomainRepository
  private readonly vercelGateway: IVercelDomainsGateway
  private readonly invalidateCache: (input: { hostname: string }) => void
  private readonly now: () => Date

  constructor(dependencies: TeamFormDomainDependencies = {}) {
    this.repository = dependencies.repository ?? teamFormDomainRepository
    this.vercelGateway = dependencies.vercelGateway ?? vercelDomainsGateway
    this.invalidateCache = dependencies.invalidateCache ?? invalidateTeamFormDomainCache
    this.now = dependencies.now ?? (() => new Date())
  }

  async getFormDomain(ctx: TeamContext): Promise<Output> {
    try {
      const domain = await this.repository.findByTeamId(ctx.teamId)
      return new Output(true, [], [], { formDomain: domain ? toDto(domain) : null })
    } catch (error) {
      console.error("[TeamFormDomainUseCase][getFormDomain]", error)
      return new Output(false, [], ["Erro ao carregar o domínio dos formulários"], null)
    }
  }

  async connectFormDomain(rawHostname: string, ctx: TeamContext): Promise<Output> {
    try {
      const validation = validateFormDomainHostname(rawHostname)
      if (!validation.ok) {
        return new Output(false, [], [validation.error], null)
      }
      const hostname = validation.hostname

      const existing = await this.repository.findByTeamId(ctx.teamId)
      if (existing) {
        return new Output(
          false,
          [],
          ["Este time já tem um domínio de formulários conectado. Remova o atual antes de conectar outro."],
          null,
        )
      }

      const hostnameInUse = await this.repository.findByHostname(hostname)
      if (hostnameInUse) {
        return new Output(false, [], ["Este subdomínio já está em uso por outra conta."], null)
      }

      if (!this.vercelGateway.isConfigured()) {
        return new Output(false, [], [NOT_CONFIGURED_MESSAGE], null)
      }

      const registration = await this.vercelGateway.addProjectDomain(hostname)
      if (!registration.ok) {
        if (registration.errorCode === "domain_already_in_use" || registration.status === 409) {
          return new Output(
            false,
            [],
            ["Este subdomínio já está vinculado a outro projeto de hospedagem. Use outro subdomínio."],
            null,
          )
        }
        console.error(
          "[TeamFormDomainUseCase][connectFormDomain] Falha ao registrar domínio:",
          registration.errorMessage,
        )
        return new Output(
          false,
          [],
          ["Não foi possível registrar o subdomínio agora. Tente novamente em instantes."],
          null,
        )
      }

      const created = await this.repository.create({
        teamId: ctx.teamId,
        hostname,
        vercelDomainId: registration.data.name ?? hostname,
      })

      this.invalidateCache({ hostname })

      const records = buildFormDomainDnsRecords({
        hostname,
        apexName: registration.data.apexName,
        verificationChallenges: registration.data.verification,
        verified: false,
      })

      return new Output(
        true,
        ["Domínio de formulários conectado. Crie o registro DNS para ativar."],
        [],
        { formDomain: toDto(created), records },
      )
    } catch (error) {
      console.error("[TeamFormDomainUseCase][connectFormDomain]", error)
      return new Output(false, [], ["Erro ao conectar o domínio dos formulários"], null)
    }
  }

  async disconnectFormDomain(ctx: TeamContext): Promise<Output> {
    try {
      const domain = await this.repository.findByTeamId(ctx.teamId)
      if (!domain) {
        return new Output(false, [], ["Nenhum domínio de formulários conectado"], null)
      }

      if (this.vercelGateway.isConfigured()) {
        const removal = await this.vercelGateway.removeProjectDomain(domain.hostname)
        if (!removal.ok && removal.status !== 404) {
          console.error(
            "[TeamFormDomainUseCase][disconnectFormDomain] Falha ao remover na infraestrutura:",
            removal.errorMessage,
          )
          return new Output(
            false,
            [],
            ["Não foi possível remover o domínio agora. Tente novamente em instantes."],
            null,
          )
        }
      }

      await this.repository.deleteById(domain.id)
      this.invalidateCache({ hostname: domain.hostname })

      return new Output(true, ["Domínio de formulários removido"], [], null)
    } catch (error) {
      console.error("[TeamFormDomainUseCase][disconnectFormDomain]", error)
      return new Output(false, [], ["Erro ao remover o domínio dos formulários"], null)
    }
  }

  async getFormDomainRecords(ctx: TeamContext): Promise<Output> {
    try {
      const domain = await this.repository.findByTeamId(ctx.teamId)
      if (!domain) {
        return new Output(false, [], ["Nenhum domínio de formulários conectado"], null)
      }

      let records: CustomDomainDnsRecord[]
      if (this.vercelGateway.isConfigured()) {
        const projectDomain = await this.vercelGateway.getProjectDomain(domain.hostname)
        records = buildFormDomainDnsRecords({
          hostname: domain.hostname,
          apexName: projectDomain.ok ? projectDomain.data.apexName : null,
          verificationChallenges: projectDomain.ok ? projectDomain.data.verification : null,
          verified: domain.status === "verified",
        })
      } else {
        records = buildFormDomainDnsRecords({
          hostname: domain.hostname,
          verified: domain.status === "verified",
        })
      }

      return new Output(true, [], [], {
        formDomain: toDto(domain),
        records,
      })
    } catch (error) {
      console.error("[TeamFormDomainUseCase][getFormDomainRecords]", error)
      return new Output(false, [], ["Erro ao carregar os registros DNS do domínio"], null)
    }
  }

  async verifyFormDomain(ctx: TeamContext): Promise<Output> {
    try {
      const domain = await this.repository.findByTeamId(ctx.teamId)
      if (!domain) {
        return new Output(false, [], ["Nenhum domínio de formulários conectado"], null)
      }

      if (!this.vercelGateway.isConfigured()) {
        return new Output(false, [], [NOT_CONFIGURED_MESSAGE], null)
      }

      const outcome = await checkFormDomainVerification(this.vercelGateway, domain.hostname)
      const checkedAt = this.now()
      const updated = await this.repository.saveCheckResult(domain.id, {
        status: outcome.status,
        lastCheckedAt: checkedAt,
        verifiedAt:
          outcome.status === "verified" ? (domain.verifiedAt ?? checkedAt) : null,
      })

      this.invalidateCache({ hostname: domain.hostname })

      const successMessage =
        outcome.status === "verified"
          ? "Domínio verificado! Os novos disparos de campanha usarão este domínio nos links de formulário."
          : outcome.reason

      return new Output(true, [successMessage], [], { formDomain: toDto(updated) })
    } catch (error) {
      console.error("[TeamFormDomainUseCase][verifyFormDomain]", error)
      return new Output(false, [], ["Erro ao verificar o domínio dos formulários"], null)
    }
  }
}
