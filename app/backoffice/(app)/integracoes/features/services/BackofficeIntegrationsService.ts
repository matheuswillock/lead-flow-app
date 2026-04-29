import type {
  BackofficeMetaIntegrationConfig,
  BackofficeMetaWebhookRequestLogItem,
  BackofficeMetaWebhookTokenHistoryItem,
  BackofficeWebhookTokenExpiryMode,
} from "../context/BackofficeIntegrationsTypes"
import type { IBackofficeIntegrationsService } from "./IBackofficeIntegrationsService"

interface BackofficeApiOutput<T> {
  isValid: boolean
  successMessages: string[]
  errorMessages: string[]
  result: T
}

async function parseOutput<T>(response: Response): Promise<T> {
  const json = (await response.json().catch(() => null)) as BackofficeApiOutput<T> | null
  if (!response.ok || !json || !json.isValid) {
    const message = json?.errorMessages?.[0] ?? `HTTP ${response.status}`
    throw new Error(message)
  }
  return json.result
}

export class BackofficeIntegrationsService implements IBackofficeIntegrationsService {
  async getMetaConfig(): Promise<BackofficeMetaIntegrationConfig> {
    const response = await fetch(`/api/v1/backoffice/integrations/meta`, {
      method: "GET",
      cache: "no-store",
    })
    return parseOutput<BackofficeMetaIntegrationConfig>(response)
  }

  async generateMetaToken(
    expiryMode: BackofficeWebhookTokenExpiryMode
  ): Promise<BackofficeMetaIntegrationConfig> {
    const response = await fetch(`/api/v1/backoffice/integrations/meta`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expiryMode }),
    })
    return parseOutput<BackofficeMetaIntegrationConfig>(response)
  }

  async listMetaTokenHistory(limit = 15): Promise<BackofficeMetaWebhookTokenHistoryItem[]> {
    const response = await fetch(
      `/api/v1/backoffice/integrations/meta?view=tokens&limit=${limit}`,
      { method: "GET", cache: "no-store" }
    )
    return parseOutput<BackofficeMetaWebhookTokenHistoryItem[]>(response)
  }

  async listMetaLogs(limit = 15): Promise<BackofficeMetaWebhookRequestLogItem[]> {
    const response = await fetch(
      `/api/v1/backoffice/integrations/meta?view=logs&limit=${limit}`,
      { method: "GET", cache: "no-store" }
    )
    return parseOutput<BackofficeMetaWebhookRequestLogItem[]>(response)
  }
}
