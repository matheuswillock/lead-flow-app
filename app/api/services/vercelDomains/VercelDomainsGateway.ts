import type {
  IVercelDomainsGateway,
  VercelDomainConfig,
  VercelDomainsGatewayResult,
  VercelProjectDomain,
} from "./IVercelDomainsGateway"

const VERCEL_API_BASE_URL = "https://api.vercel.com"

type VercelDomainsGatewayEnv = {
  token?: string
  projectId?: string
  teamId?: string
}

function readVercelEnv(): VercelDomainsGatewayEnv {
  return {
    token: process.env.VERCEL_TOKEN,
    projectId: process.env.VERCEL_PROJECT_ID,
    teamId: process.env.VERCEL_TEAM_ID,
  }
}

/**
 * Implementação concreta via `fetch` para api.vercel.com.
 *
 * Endpoints usados (Authorization: Bearer `VERCEL_TOKEN`):
 * - POST   /v10/projects/{VERCEL_PROJECT_ID}/domains          → registra o domínio no projeto
 * - GET    /v9/projects/{VERCEL_PROJECT_ID}/domains/{domain}  → estado do domínio no projeto
 * - DELETE /v9/projects/{VERCEL_PROJECT_ID}/domains/{domain}  → remove o domínio do projeto
 * - GET    /v6/domains/{domain}/config                        → status de configuração DNS
 *
 * `VERCEL_TEAM_ID` é opcional: obrigatório apenas quando o projeto pertence a
 * um time na Vercel (vira query param `teamId`).
 */
export class VercelDomainsGateway implements IVercelDomainsGateway {
  constructor(private readonly env: VercelDomainsGatewayEnv = readVercelEnv()) {}

  isConfigured(): boolean {
    return Boolean(this.env.token && this.env.projectId)
  }

  async addProjectDomain(hostname: string): Promise<VercelDomainsGatewayResult<VercelProjectDomain>> {
    return this.request<VercelProjectDomain>({
      method: "POST",
      path: `/v10/projects/${encodeURIComponent(this.env.projectId ?? "")}/domains`,
      body: { name: hostname },
    })
  }

  async getProjectDomain(hostname: string): Promise<VercelDomainsGatewayResult<VercelProjectDomain>> {
    return this.request<VercelProjectDomain>({
      method: "GET",
      path: `/v9/projects/${encodeURIComponent(this.env.projectId ?? "")}/domains/${encodeURIComponent(hostname)}`,
    })
  }

  async removeProjectDomain(hostname: string): Promise<VercelDomainsGatewayResult<{ removed: boolean }>> {
    const result = await this.request<Record<string, unknown>>({
      method: "DELETE",
      path: `/v9/projects/${encodeURIComponent(this.env.projectId ?? "")}/domains/${encodeURIComponent(hostname)}`,
    })
    if (!result.ok) return result
    return { ok: true, data: { removed: true } }
  }

  async getDomainConfig(hostname: string): Promise<VercelDomainsGatewayResult<VercelDomainConfig>> {
    return this.request<VercelDomainConfig>({
      method: "GET",
      path: `/v6/domains/${encodeURIComponent(hostname)}/config`,
    })
  }

  private async request<T>(options: {
    method: "GET" | "POST" | "DELETE"
    path: string
    body?: Record<string, unknown>
  }): Promise<VercelDomainsGatewayResult<T>> {
    if (!this.isConfigured()) {
      return {
        ok: false,
        status: 503,
        errorCode: "not_configured",
        errorMessage:
          "Integração de domínios não configurada (VERCEL_TOKEN/VERCEL_PROJECT_ID ausentes)",
      }
    }

    const url = new URL(`${VERCEL_API_BASE_URL}${options.path}`)
    if (this.env.teamId) {
      url.searchParams.set("teamId", this.env.teamId)
    }

    try {
      const response = await fetch(url.toString(), {
        method: options.method,
        headers: {
          Authorization: `Bearer ${this.env.token}`,
          ...(options.body ? { "Content-Type": "application/json" } : {}),
        },
        ...(options.body ? { body: JSON.stringify(options.body) } : {}),
        cache: "no-store",
      })

      const payload = (await response.json().catch(() => null)) as
        | (T & { error?: { code?: string; message?: string } })
        | null

      if (!response.ok) {
        return {
          ok: false,
          status: response.status,
          errorCode: payload?.error?.code,
          errorMessage:
            payload?.error?.message ?? `Vercel API respondeu ${response.status} em ${options.path}`,
        }
      }

      return { ok: true, data: (payload ?? {}) as T }
    } catch (error) {
      console.error("[VercelDomainsGateway] Falha de rede na Vercel API:", error)
      return {
        ok: false,
        status: 502,
        errorCode: "network_error",
        errorMessage: "Falha de comunicação com a Vercel API",
      }
    }
  }
}

export const vercelDomainsGateway = new VercelDomainsGateway()
