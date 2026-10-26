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
