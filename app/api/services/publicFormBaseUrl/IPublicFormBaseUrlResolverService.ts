/**
 * Resolve a base pública dos links de formulário de um time no momento do
 * disparo de campanha.
 *
 * Precedência:
 * 1. `team-domain`  — domínio de formulários VERIFICADO do time.
 * 2. `fallback-env` — host neutro configurável (`PUBLIC_FORMS_FALLBACK_HOST`).
 * 3. `platform`     — sem os anteriores: mantém o comportamento de hoje
 *    (links saem como estão no HTML, sem troca de host).
 */

export type PublicFormBaseUrlSource = "team-domain" | "fallback-env" | "platform"

export type PublicFormBaseUrlResolution = {
  /** Origem absoluta (https://host) ou null quando não derivável. */
  baseUrl: string | null
  source: PublicFormBaseUrlSource
}

export interface IPublicFormBaseUrlResolverService {
  resolvePublicFormBaseUrl(teamId: string): Promise<PublicFormBaseUrlResolution>
  /** Intersecção dos publicIds informados com os formulários do time. */
  filterFormPublicIdsOwnedByTeam(teamId: string, publicIds: string[]): Promise<Set<string>>
}
