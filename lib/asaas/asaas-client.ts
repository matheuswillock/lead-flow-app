import { resolveAsaasAccount, type AsaasAccountId } from "./asaas-account"
import { buildAsaasEndpoints, type AsaasEndpoints } from "./asaas-endpoints"

export type AsaasClient = {
  endpoints: AsaasEndpoints
  request(endpoint: string, options?: RequestInit): Promise<any>
}

/**
 * Cliente Asaas por conta (DA2). Reproduz fielmente o comportamento de
 * `asaasFetch` original (`lib/asaas.ts`): mesmos headers, mesma checagem de
 * erro, mesma mensagem quando a API key não está configurada — só que
 * parametrizado por `accountId` em vez de ler `process.env` direto no corpo
 * da função.
 */
export function createAsaasClient(accountId: AsaasAccountId): AsaasClient {
  const account = resolveAsaasAccount(accountId)
  const endpoints = buildAsaasEndpoints(account.baseUrl)

  async function request(endpoint: string, options?: RequestInit): Promise<any> {
    if (!account.apiKey) {
      throw new Error("ASAAS_API_KEY não configurada")
    }

    try {
      const response = await fetch(endpoint, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          access_token: `$${account.apiKey}`,
          ...options?.headers,
        },
        cache: "no-store",
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ errors: [] }))
        const errorMessage =
          error.errors?.[0]?.description || `Erro na API Asaas: ${response.status}`
        const err = new Error(errorMessage)
        ;(err as any).statusCode = response.status
        throw err
      }

      return response.json()
    } catch (error: any) {
      console.error(`❌ Erro na requisição Asaas (conta ${accountId}):`, error)
      throw error
    }
  }

  return { endpoints, request }
}
