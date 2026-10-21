import type { HealthCheckCapability, ProviderHealthCheckResult } from "@/lib/payment-provider/contracts"
import type { AsaasAccountId } from "./asaas-account"
import { createAsaasClient } from "./asaas-client"

/** Sonda leve de leitura (uma página de clientes); não cria cobrança nem altera a conta. */
export function createAsaasHealthCheck(accountId: AsaasAccountId): HealthCheckCapability {
  return {
    async checkHealth(): Promise<ProviderHealthCheckResult> {
      try {
        const client = createAsaasClient(accountId)
        await client.request(`${client.endpoints.customers}?limit=1`, { method: "GET" })
        return { healthy: true }
      } catch (error) {
        const status = (error as { statusCode?: number } | null)?.statusCode
        if (status === 401 || status === 403) {
          return { healthy: false, errorCode: "AUTHENTICATION_FAILED", errorMessage: "O provedor recusou a credencial" }
        }
        if (error instanceof Error && error.message.includes("não configurada")) {
          return { healthy: false, errorCode: "CONFIGURATION_INVALID", errorMessage: "Credenciais do provider ausentes ou inválidas" }
        }
        return { healthy: false, errorCode: "REMOTE_REQUEST_FAILED", errorMessage: "Falha ao consultar o provedor" }
      }
    },
  }
}
