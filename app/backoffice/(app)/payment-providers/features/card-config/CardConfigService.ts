import { API_CLIENT_BASE } from "@/lib/route-map"
import { ApiRequestError } from "@/lib/http/api-request-error"
import type {
  AbacateCardConfig,
  CardConfigEnvironment,
  ICardConfigService,
  PaymentProvider,
  ProviderVariablesConfig,
} from "./ICardConfigService"

const CONFIG_URL = `${API_CLIENT_BASE}/backoffice/payment-providers/config`
const ABACATE_PROVIDER = "ABACATE_PAY"

interface OutputResponse<T> {
  isValid: boolean
  errorMessages?: string[]
  result?: T
}

interface ProviderConfigRecord {
  provider: PaymentProvider
  environment: CardConfigEnvironment
  isDefault: boolean
  cardEnabled: boolean
  publicKey?: string | null
  variables?: ProviderVariablesConfig["variables"]
  revision: number
}

export class CardConfigRequestError extends ApiRequestError {
  constructor(message: string, status: number) {
    super(message, status)
    this.name = "CardConfigRequestError"
  }
}

async function parseOutput<T>(response: Response): Promise<T> {
  let data: OutputResponse<T>
  try {
    data = (await response.json()) as OutputResponse<T>
  } catch {
    throw new CardConfigRequestError("Resposta inesperada do servidor", response.status)
  }
  if (!response.ok || !data.isValid || data.result === undefined || data.result === null) {
    throw new CardConfigRequestError(
      data.errorMessages?.[0] ?? "Erro ao processar a configuração de cartão",
      response.status
    )
  }
  return data.result
}

function toCardConfig(record: ProviderConfigRecord): AbacateCardConfig {
  return {
    environment: record.environment,
    cardEnabled: record.cardEnabled === true,
    publicKey: record.publicKey ?? null,
    revision: record.revision,
  }
}

export class CardConfigService implements ICardConfigService {
  async getAbacateCardConfig(environment: CardConfigEnvironment): Promise<AbacateCardConfig | null> {
    const res = await fetch(`${CONFIG_URL}?environment=${environment}`, { cache: "no-store" })
    const records = await parseOutput<ProviderConfigRecord[]>(res)
    const abacate = records.find((record) => record.provider === ABACATE_PROVIDER && record.isDefault)
    return abacate ? toCardConfig(abacate) : null
  }

  async setCardEnabled(
    environment: CardConfigEnvironment,
    cardEnabled: boolean,
    expectedRevision: number
  ): Promise<AbacateCardConfig> {
    const res = await fetch(CONFIG_URL, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        environment,
        provider: ABACATE_PROVIDER,
        patch: { cardEnabled, expectedRevision },
      }),
    })
    return toCardConfig(await parseOutput<ProviderConfigRecord>(res))
  }

  async setPublicKey(environment: CardConfigEnvironment, publicKey: string | null, expectedRevision: number) {
    const res = await fetch(CONFIG_URL, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ environment, provider: ABACATE_PROVIDER, patch: { publicKey, expectedRevision } }),
    })
    return toCardConfig(await parseOutput<ProviderConfigRecord>(res))
  }

  async getProviderConfigs(environment: CardConfigEnvironment): Promise<ProviderVariablesConfig[]> {
    const response = await fetch(`${CONFIG_URL}?environment=${environment}`, { cache: "no-store" })
    const records = await parseOutput<ProviderConfigRecord[]>(response)
    const byProvider = new Map<PaymentProvider, ProviderConfigRecord>()
    for (const record of records) {
      const current = byProvider.get(record.provider)
      if (!current || (record.isDefault && !current.isDefault)) byProvider.set(record.provider, record)
    }
    return [...byProvider.values()].map((record) => ({
      provider: record.provider,
      environment: record.environment,
      revision: record.revision,
      variables: record.variables ?? [],
    }))
  }

  async setProviderVariables(
    provider: PaymentProvider,
    environment: CardConfigEnvironment,
    variables: Array<{ name: string; visibility: "PUBLIC" | "SECRET"; value?: string }>,
    expectedRevision: number,
  ): Promise<ProviderVariablesConfig> {
    const response = await fetch(CONFIG_URL, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ environment, provider, patch: { variables, expectedRevision } }),
    })
    const record = await parseOutput<ProviderConfigRecord>(response)
    return {
      provider: record.provider,
      environment: record.environment,
      revision: record.revision,
      variables: record.variables ?? [],
    }
  }
}
