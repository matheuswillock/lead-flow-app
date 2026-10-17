import { resolveAsaasAccount, type AsaasAccountId } from "@/lib/asaas"
import type { IAsaasMigrationGateway } from "@/app/api/infra/gateways/asaasMigration/IAsaasMigrationGateway"
import type { PaymentProviderMetadata } from "@/lib/payment-provider/contracts"
import { PaymentProviderError } from "@/lib/payment-provider/errors"
import type { PaymentProviderEnvironment } from "@/lib/payment-provider/types"
import {
  PaymentProviderBase,
  type PaymentProviderDependencies,
  type ProviderRuntimeConfig,
} from "./PaymentProviderBase"

/** Conta Asaas cujo tráfego este adapter encapsula por padrão. */
const DEFAULT_ASAAS_ACCOUNT: AsaasAccountId = "primary"

/** Hosts Asaas conhecidos e o ambiente que cada um implica. */
const ASAAS_ENVIRONMENT_BY_HOST: Readonly<Record<string, PaymentProviderEnvironment>> = {
  "www.asaas.com": "PRODUCTION",
  "api.asaas.com": "PRODUCTION",
  "sandbox.asaas.com": "DEV",
}

const ASAAS_ACCOUNTS: readonly AsaasAccountId[] = ["primary", "legacy"]

/**
 * Configuração de runtime completa do adapter: base URL efetiva, conta
 * vinculada e ambiente. Resolvida da fonte única (`resolveAsaasAccount`) por
 * padrão, mas injetável para composição e testes.
 */
export type AsaasProviderRuntimeConfig = ProviderRuntimeConfig & {
  readonly account: AsaasAccountId
  readonly environment: PaymentProviderEnvironment
}

export type AsaasProviderOptions = {
  readonly config?: AsaasProviderRuntimeConfig
  readonly dependencies?: PaymentProviderDependencies
}

function defaultAsaasConfig(): AsaasProviderRuntimeConfig {
  const account = resolveAsaasAccount(DEFAULT_ASAAS_ACCOUNT)
  return {
    baseUrl: account.baseUrl,
    account: DEFAULT_ASAAS_ACCOUNT,
    environment: account.environment === "production" ? "PRODUCTION" : "DEV",
  }
}

/**
 * Valida e congela a configuração injetada. Espelha o guard do irmão
 * `PaymentProviderConfig`: HTTPS sem credenciais/porta/caminho/query, ambiente
 * fechado e coerência host↔ambiente (para hosts Asaas conhecidos). Retorna uma
 * cópia congelada para que uma config mutável do chamador não retargete o
 * adapter após a construção.
 */
function resolveRuntimeConfig(config: AsaasProviderRuntimeConfig): AsaasProviderRuntimeConfig {
  if (config.environment !== "DEV" && config.environment !== "PRODUCTION") {
    throw new PaymentProviderError("CONFIGURATION_INVALID", "Ambiente Asaas inválido")
  }
  if (!ASAAS_ACCOUNTS.includes(config.account)) {
    throw new PaymentProviderError("CONFIGURATION_INVALID", "Conta Asaas inválida")
  }
  let parsed: URL
  try {
    parsed = new URL(config.baseUrl)
  } catch {
    throw new PaymentProviderError("CONFIGURATION_INVALID", "baseUrl Asaas inválida")
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.port !== "" ||
    parsed.pathname !== "/" ||
    parsed.search !== "" ||
    parsed.hash !== ""
  ) {
    throw new PaymentProviderError("CONFIGURATION_INVALID", "baseUrl Asaas inválida")
  }
  const hostname = parsed.hostname.replace(/\.$/, "")
  if (hostname.length === 0 || hostname.split(".").some((label) => label.length === 0)) {
    throw new PaymentProviderError("CONFIGURATION_INVALID", "baseUrl Asaas inválida")
  }
  const expectedEnvironment = ASAAS_ENVIRONMENT_BY_HOST[hostname]
  if (expectedEnvironment && expectedEnvironment !== config.environment) {
    throw new PaymentProviderError(
      "CONFIGURATION_INVALID",
      "Ambiente Asaas incompatível com a base URL",
    )
  }
  return Object.freeze({ ...config })
}

/**
 * Seam provider-neutral para o Asaas durante a coexistência.
 * Os fluxos Legacy continuam usando o gateway diretamente; esta classe não
 * declara capabilities novas até que o contrato transparente seja concluído.
 *
 * O adapter encapsula o gateway legado por uma configuração de runtime completa
 * e validada (baseUrl + binding de conta + ambiente) em vez de um `baseUrl`
 * vazio.
 */
export class AsaasPaymentProvider extends PaymentProviderBase<AsaasProviderRuntimeConfig> {
  readonly metadata: PaymentProviderMetadata
  readonly account: AsaasAccountId
  readonly baseUrl: string

  constructor(
    readonly gateway: IAsaasMigrationGateway,
    options: AsaasProviderOptions = {},
  ) {
    const config = resolveRuntimeConfig(options.config ?? defaultAsaasConfig())
    super("ASAAS", config.environment, config, options.dependencies)
    this.account = config.account
    this.baseUrl = config.baseUrl
    this.metadata = Object.freeze({
      key: "ASAAS",
      environment: config.environment,
      capabilities: Object.freeze([]),
    })
  }
}
