import type { PaymentProviderEnvironment, PaymentProviderKey } from "./types"

/**
 * Descritor das credenciais por adapter. A UI o usa para montar o formulário; o resolver usa
 * `envFallbackNames` para o modo de transição (banco primeiro, ambiente como reserva).
 */

export const CREDENTIAL_KEY_PATTERN = /^[A-Z][A-Z0-9_]{1,63}$/

export type CredentialInstanceScope = {
  readonly environment: PaymentProviderEnvironment
  readonly externalAccountContext: string
}

export type CredentialFieldDescriptor = {
  readonly key: string
  readonly label: string
  readonly required: boolean
  readonly secret: boolean
  /**
   * Campo de POLÍTICA (não específico da conta): mantém a reserva de ambiente em toda instância,
   * para que uma instância secundária nunca perca, em silêncio, uma restrição definida no ambiente.
   */
  readonly policy?: boolean
  readonly hint: string
  /** Nomes de variável de ambiente (em ordem de precedência) usados como reserva. */
  readonly envFallbackNames?: (scope: CredentialInstanceScope) => readonly string[]
}

export type AdapterDescriptor = {
  readonly providerKey: PaymentProviderKey
  readonly label: string
  /** false: o router não seleciona o adapter para pagamentos; a instância só guarda credenciais. */
  readonly paymentCapable: boolean
  /** `settings` da instância que se aplicam ao adapter (o PUT rejeita as demais). */
  readonly applicableSettings: readonly ("requireSignature" | "cardEnabled")[]
  /**
   * true: os nomes de variável de ambiente não dependem do contexto da conta (valem para o
   * provider/ambiente inteiro), então só a instância principal pode usá-los como reserva.
   */
  readonly envFallbackSharedAcrossInstances: boolean
  readonly fields: readonly CredentialFieldDescriptor[]
}

function abacateEnv(suffix: string) {
  return ({ environment }: CredentialInstanceScope) => [
    `ABACATE_PAY_${environment}_${suffix}`,
    `ABACATE_PAY_${suffix}`,
  ]
}

/** `primary` usa ASAAS_*; `legacy` usa ASAAS_LEGACY_* (somente API_KEY e WEBHOOK_TOKEN existem). */
function asaasEnv(suffix: string, options: { legacy: boolean }) {
  return ({ externalAccountContext }: CredentialInstanceScope) =>
    externalAccountContext === "legacy"
      ? options.legacy
        ? [`ASAAS_LEGACY_${suffix}`]
        : []
      : [`ASAAS_${suffix}`]
}

const ADAPTERS: readonly AdapterDescriptor[] = Object.freeze([
  {
    providerKey: "ABACATE_PAY",
    label: "Abacate Pay",
    paymentCapable: true,
    applicableSettings: ["requireSignature", "cardEnabled"],
    envFallbackSharedAcrossInstances: true,
    fields: [
      {
        key: "API_KEY",
        label: "Chave de API",
        required: true,
        secret: true,
        hint: "Chave secreta da loja no painel do Abacate Pay.",
        envFallbackNames: abacateEnv("API_KEY"),
      },
      {
        key: "WEBHOOK_SECRET",
        label: "Segredo do webhook",
        required: true,
        secret: true,
        hint: "Segredo enviado na URL do webhook cadastrado no Abacate Pay.",
        envFallbackNames: abacateEnv("WEBHOOK_SECRET"),
      },
      {
        key: "PUBLIC_KEY",
        label: "Chave pública",
        required: false,
        secret: true,
        hint: "Habilita cartão e a assinatura HMAC do webhook. Obrigatória em DEV.",
        envFallbackNames: abacateEnv("PUBLIC_KEY"),
      },
      {
        key: "WEBHOOK_SECRET_PREVIOUS",
        label: "Segredo anterior do webhook",
        required: false,
        secret: true,
        hint: "Mantém o segredo antigo válido durante a rotação; remova ao concluir.",
        envFallbackNames: abacateEnv("WEBHOOK_SECRET_PREVIOUS"),
      },
      {
        key: "REQUIRE_SIGNATURE",
        label: "Exigir assinatura",
        required: false,
        secret: false,
        policy: true,
        hint: "Use true para recusar eventos sem assinatura HMAC válida.",
        envFallbackNames: abacateEnv("REQUIRE_SIGNATURE"),
      },
    ],
  },
  {
    providerKey: "ASAAS",
    label: "Asaas",
    paymentCapable: false,
    applicableSettings: [],
    envFallbackSharedAcrossInstances: false,
    fields: [
      {
        key: "API_KEY",
        label: "Chave de API",
        required: true,
        secret: true,
        hint: "Chave da conta Asaas (formato aact_...).",
        envFallbackNames: asaasEnv("API_KEY", { legacy: true }),
      },
      {
        key: "WEBHOOK_TOKEN",
        label: "Token do webhook",
        required: true,
        secret: true,
        hint: "Token configurado no webhook da conta Asaas.",
        envFallbackNames: asaasEnv("WEBHOOK_TOKEN", { legacy: true }),
      },
      {
        key: "WALLET_ID",
        label: "Wallet ID",
        required: false,
        secret: false,
        hint: "Carteira usada em splits, quando houver.",
        envFallbackNames: asaasEnv("WALLET_ID", { legacy: false }),
      },
    ],
  },
])

export function listAdapterDescriptors(): readonly AdapterDescriptor[] {
  return ADAPTERS
}

export function getAdapterDescriptor(providerKey: PaymentProviderKey): AdapterDescriptor {
  const descriptor = ADAPTERS.find((adapter) => adapter.providerKey === providerKey)
  if (!descriptor) throw new Error("Adapter de provider desconhecido")
  return descriptor
}

export function isPaymentCapableProvider(providerKey: PaymentProviderKey): boolean {
  return getAdapterDescriptor(providerKey).paymentCapable
}

/**
 * Chaves que apontam para um destino de rede (URL/host/endpoint) NÃO são credenciais editáveis:
 * a API key viajaria para o destino escolhido (SSRF/exfiltração). A URL base de cada adapter é
 * derivada do código/ambiente (ex.: Asaas via ASAAS_ENV).
 */
const NETWORK_TARGET_KEY_PATTERN = /(^|_)(URL|URI|HOST|HOSTNAME|ENDPOINT|DOMAIN)$/

export function isValidCredentialKey(key: unknown): key is string {
  return (
    typeof key === "string" && CREDENTIAL_KEY_PATTERN.test(key) && !NETWORK_TARGET_KEY_PATTERN.test(key)
  )
}

/**
 * Chaves de política (ex.: REQUIRE_SIGNATURE) são configuração da instância, controladas pelos
 * `settings`: não podem ser gravadas como credencial em nenhum adapter, nem no que não as declara.
 */
const POLICY_CREDENTIAL_KEYS: ReadonlySet<string> = new Set([
  "REQUIRE_SIGNATURE",
  "CARD_PAYMENTS_ENABLED",
  ...ADAPTERS.flatMap((descriptor) =>
    descriptor.fields.filter((field) => field.policy).map((field) => field.key),
  ),
])

export function isPolicyCredentialKey(key: string): boolean {
  return POLICY_CREDENTIAL_KEYS.has(key)
}

export function isRequiredCredentialKey(providerKey: PaymentProviderKey, key: string): boolean {
  return getAdapterDescriptor(providerKey).fields.some(
    (field) => field.key === key && field.required,
  )
}

/** Chaves extras arbitrárias são permitidas, sem reserva no ambiente. */
export function envFallbackNames(
  providerKey: PaymentProviderKey,
  key: string,
  scope: CredentialInstanceScope,
): readonly string[] {
  const field = getAdapterDescriptor(providerKey).fields.find((candidate) => candidate.key === key)
  return field?.envFallbackNames?.(scope) ?? []
}
