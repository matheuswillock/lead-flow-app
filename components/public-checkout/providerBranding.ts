export type CheckoutPaymentProvider = "ASAAS" | "ABACATE_PAY"

/**
 * Forma alinhada às colunas `logo_url` / `logo_alt_text` de `payment_provider_configs`,
 * para o futuro gerenciador de providers do backoffice preencher este dado.
 */
export interface ProviderBranding {
  /** Fallback textual, usado quando não há logo. */
  label: string
  logoUrl?: string
  logoAlt?: string
}

export const DEFAULT_CHECKOUT_PROVIDER: CheckoutPaymentProvider = "ASAAS"

/**
 * Catálogo estático de identidade por provider. Isolado neste módulo para que o futuro
 * gerenciador de providers (SPEC Pagamentos 2026-10, Fase 7) o substitua por dado.
 * Só referencie logo cujo asset exista em `public/`.
 */
const PROVIDER_BRANDING: Record<CheckoutPaymentProvider, ProviderBranding> = {
  ASAAS: {
    label: "Asaas Pagamentos",
    logoUrl: "/asaas-pagamentos-logo.svg",
    logoAlt: "Asaas Pagamentos",
  },
  ABACATE_PAY: {
    label: "Pagamento processado pela AbacatePay",
  },
}

export function getProviderBranding(
  provider: CheckoutPaymentProvider = DEFAULT_CHECKOUT_PROVIDER
): ProviderBranding {
  return PROVIDER_BRANDING[provider]
}

/**
 * Identidade configurada no banco (`display_name`, `logo_url`, `logo_alt_text` de
 * `payment_provider_configs`), vinda dos detalhes que cada checkout já busca.
 */
export interface ProviderBrandingOverride {
  displayName?: string | null
  logoUrl?: string | null
  logoAltText?: string | null
}

function clean(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

/** Só caminhos do próprio site ou https; qualquer outro esquema é descartado. */
function safeLogoUrl(value: string | null | undefined): string | undefined {
  const url = clean(value)
  if (!url) return undefined
  if (url.startsWith("/") && !url.startsWith("//")) return url
  return url.startsWith("https://") ? url : undefined
}

export function hasBrandingOverride(override?: ProviderBrandingOverride | null): boolean {
  return Boolean(clean(override?.displayName) || safeLogoUrl(override?.logoUrl))
}

/**
 * Dado do banco vence; sem ele, vale o catálogo estático (fallback). Quando o banco
 * define a identidade, o logo estático do provider não é misturado com o nome do banco.
 */
export function resolveProviderBranding(
  provider: CheckoutPaymentProvider | undefined,
  override?: ProviderBrandingOverride | null
): ProviderBranding {
  if (!hasBrandingOverride(override)) return getProviderBranding(provider)

  const fallback = getProviderBranding(provider)
  const label = clean(override?.displayName) ?? fallback.label
  const logoUrl = safeLogoUrl(override?.logoUrl)
  return {
    label,
    ...(logoUrl ? { logoUrl, logoAlt: clean(override?.logoAltText) ?? label } : {}),
  }
}
