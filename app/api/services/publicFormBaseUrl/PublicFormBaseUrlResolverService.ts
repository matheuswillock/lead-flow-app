import { normalizeHostname } from "@/lib/proxy/forms-host"
import type {
  IPublicFormBaseUrlResolver,
  PublicFormBaseUrlResolution,
} from "@/lib/public-forms/public-form-base-url-resolution"
import type { ITeamFormDomainRepository } from "@/app/api/infra/data/repositories/teamFormDomain/ITeamFormDomainRepository"
import { teamFormDomainRepository } from "@/app/api/infra/data/repositories/teamFormDomain/TeamFormDomainRepository"
import type { IPublicFormsRepository } from "@/app/api/infra/data/repositories/publicForms/IPublicFormsRepository"
import { publicFormsRepository } from "@/app/api/infra/data/repositories/publicForms/PublicFormsRepository"

function resolveFallbackEnvBaseUrl(): string | null {
  const hostname = normalizeHostname(
    process.env.PUBLIC_FORMS_FALLBACK_HOST?.replace(/^https?:\/\//i, "").replace(/\/.*$/, ""),
  )
  return hostname ? `https://${hostname}` : null
}

function resolvePlatformBaseUrl(): string | null {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) return null
  try {
    return new URL(appUrl).origin
  } catch {
    return null
  }
}

/**
 * Implementação concreta da porta `IPublicFormBaseUrlResolver` (ver
 * `lib/public-forms/public-form-base-url-resolution.ts`). Injetada no
 * `EmailCampaignDispatchService` pelo UseCase de campanha.
 */
export class PublicFormBaseUrlResolverService implements IPublicFormBaseUrlResolver {
  constructor(
    private readonly formDomainRepository: ITeamFormDomainRepository = teamFormDomainRepository,
    private readonly formsRepository: IPublicFormsRepository = publicFormsRepository,
  ) {}

  /**
   * Sem cache entre chamadas, de propósito.
   *
   * Existia aqui um cache module-level de 30 s que NENHUMA mutação invalidava
   * (verify/disconnect só derrubam a tag de tenancy por hostname, e em
   * serverless o Map nem sequer é o mesmo entre isolates). O efeito era um
   * disparo nos 30 s seguintes a uma mudança reescrever links para um domínio
   * recém-removido — ou continuar no fallback logo após a verificação.
   *
   * O custo de tirar: um `findUnique` indexado por chamada de `dispatchBatch`
   * (lote de 100 destinatários), desprezível ao lado das chamadas HTTP ao
   * Resend do mesmo lote. Frescor > 1 query por 100 e-mails.
   */
  async resolvePublicFormBaseUrl(teamId: string): Promise<PublicFormBaseUrlResolution> {
    return this.resolveBaseUrlFromRepository(teamId)
  }

  async filterFormPublicIdsOwnedByTeam(
    teamId: string,
    publicIds: string[],
  ): Promise<Set<string>> {
    if (publicIds.length === 0) return new Set()

    const owned = await this.formsRepository.findPublicIdsOwnedByTeam(teamId, publicIds)
    return new Set(owned.map((publicId) => publicId.toLowerCase()))
  }

  private async resolveBaseUrlFromRepository(teamId: string): Promise<PublicFormBaseUrlResolution> {
    const domain = await this.formDomainRepository.findByTeamId(teamId)

    if (domain?.status === "verified") {
      return { baseUrl: `https://${domain.hostname}`, source: "team-domain" }
    }

    const fallbackBaseUrl = resolveFallbackEnvBaseUrl()
    if (fallbackBaseUrl) {
      return { baseUrl: fallbackBaseUrl, source: "fallback-env" }
    }

    return { baseUrl: resolvePlatformBaseUrl(), source: "platform" }
  }
}

export const publicFormBaseUrlResolverService = new PublicFormBaseUrlResolverService()
