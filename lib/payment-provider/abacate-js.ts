/**
 * Cliente do abacatepay.js (cartão transparente do Abacate Pay). O script desenha os campos do
 * cartão num iframe seguro: número e CVV nunca passam pelo nosso código; só recebemos o token.
 * Docs: https://docs.abacatepay.com/pages/transparents/abacatepay-js
 */

export const ABACATE_JS_URL = "https://abacatepay.com/abacatepay.js"

export type AbacateCardState = {
  canTokenize: boolean
  isComplete: boolean
  isValid: boolean
  errors?: Partial<Record<"number" | "expiry" | "cvc" | "name", string>>
}

export type AbacateTokenizeCustomer = {
  name: string
  email: string
  /** CPF ou CNPJ, com ou sem máscara. */
  taxId: string
  cellphone?: string
}

export type AbacateTokenizeResult = {
  /** `ctok_...`: vale 60 segundos e uma única cobrança. */
  token: string
  expiresIn: number
  brand: string
  lastFour: string
}

export type AbacateCheckout = {
  mount(target: string | HTMLElement): Promise<void>
  tokenize(customer: AbacateTokenizeCustomer): Promise<AbacateTokenizeResult>
  destroy(): void
  readonly canTokenize: boolean
}

export type AbacateCreateOptions = {
  publicKey: string
  /** Total em centavos (mínimo 100); precisa ser igual ao valor cobrado no servidor. */
  amount: number
  locale?: "pt" | "en" | "es"
  icons?: boolean
  theme?: { styles: Record<string, Record<string, string>> }
  onReady?: () => void
  onCardChange?: (state: AbacateCardState) => void
}

export type AbacatePayGlobal = {
  create(options: AbacateCreateOptions): AbacateCheckout
}

declare global {
  interface Window {
    AbacatePay?: AbacatePayGlobal
  }
}

let loading: Promise<AbacatePayGlobal> | null = null

/** Carrega o abacatepay.js uma única vez por página (sempre do endereço oficial). */
export function loadAbacatePay(): Promise<AbacatePayGlobal> {
  if (typeof window === "undefined") return Promise.reject(new Error("abacatepay.js só roda no navegador"))
  if (window.AbacatePay) return Promise.resolve(window.AbacatePay)
  if (loading) return loading

  loading = new Promise<AbacatePayGlobal>((resolve, reject) => {
    const script = document.createElement("script")
    script.src = ABACATE_JS_URL
    script.async = true
    script.onload = () => {
      if (window.AbacatePay) resolve(window.AbacatePay)
      else reject(new Error("abacatepay.js carregou sem o objeto AbacatePay"))
    }
    script.onerror = () => {
      loading = null
      reject(new Error("Não foi possível carregar o formulário seguro do cartão."))
    }
    document.head.appendChild(script)
  })
  return loading
}

const ERROR_MESSAGES: Record<string, string> = {
  CARD_INCOMPLETE: "Preencha todos os dados do cartão.",
  CARD_INVALID: "Confira os dados do cartão.",
  THREE_DS_FAILED: "O banco não confirmou a autenticação do cartão. Tente de novo ou use outro cartão.",
  PROVIDER_LOAD: "O formulário seguro do cartão não carregou. Desative bloqueadores e tente de novo.",
  NETWORK: "Falha de conexão. Tente de novo.",
  NOT_MOUNTED: "O formulário do cartão ainda está carregando. Tente de novo em instantes.",
}

/** Mensagem para o cliente a partir de um erro do abacatepay.js (sem expor detalhes técnicos). */
export function describeAbacateError(error: unknown): string {
  const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : ""
  if (ERROR_MESSAGES[code]) return ERROR_MESSAGES[code]
  return "Não foi possível validar o cartão. Confira os dados ou use outro cartão."
}
