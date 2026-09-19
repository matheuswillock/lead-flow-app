/**
 * Gateway para a API de domínios da Vercel (api.vercel.com), usada para
 * registrar o domínio de formulários do time no projeto da plataforma.
 *
 * A implementação concreta depende das envs server-only `VERCEL_TOKEN` e
 * `VERCEL_PROJECT_ID`. Quando ausentes, `isConfigured()` retorna `false` e as
 * rotas devem responder com erro claro de integração não configurada — nunca
 * quebrar build/testes pela ausência das envs.
 */

/** Desafio de verificação retornado pela Vercel (ex.: TXT `_vercel`). */
export type VercelDomainVerificationChallenge = {
  type: string
  domain: string
  value: string
  reason?: string
}

export type VercelProjectDomain = {
  name: string
  apexName?: string
  projectId?: string
  /** Propriedade do domínio confirmada pela Vercel. */
  verified: boolean
  verification?: VercelDomainVerificationChallenge[]
}

export type VercelDomainConfig = {
  /** `false` quando o DNS aponta corretamente para a Vercel. */
  misconfigured: boolean
  configuredBy?: string | null
}

export type VercelDomainsGatewayResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; errorCode?: string; errorMessage: string }

export interface IVercelDomainsGateway {
  /** Envs `VERCEL_TOKEN` + `VERCEL_PROJECT_ID` presentes? */
  isConfigured(): boolean
  addProjectDomain(hostname: string): Promise<VercelDomainsGatewayResult<VercelProjectDomain>>
  getProjectDomain(hostname: string): Promise<VercelDomainsGatewayResult<VercelProjectDomain>>
  removeProjectDomain(hostname: string): Promise<VercelDomainsGatewayResult<{ removed: boolean }>>
  getDomainConfig(hostname: string): Promise<VercelDomainsGatewayResult<VercelDomainConfig>>
}
