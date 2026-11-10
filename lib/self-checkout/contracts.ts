import { z } from "zod"
import { isValidCNPJ } from "@/lib/masks"

/**
 * Contrato do auto-checkout público do CRM. Fonte única para a rota, o serviço e a página
 * `/comprar`. O preço nunca viaja do navegador: o cliente envia só o ciclo.
 */
export const SELF_CHECKOUT_CYCLES = [
  "monthly",
  "quarterly",
  "quadrimester",
  "semiannual",
  "annual",
] as const

export type SelfCheckoutCycle = (typeof SELF_CHECKOUT_CYCLES)[number]

export const SELF_CHECKOUT_ERROR_CODES = {
  ACCOUNT_EXISTS: "ACCOUNT_EXISTS",
  COUPON_INVALID: "COUPON_INVALID",
  CYCLE_UNAVAILABLE: "CYCLE_UNAVAILABLE",
  PROVIDER_UNAVAILABLE: "PROVIDER_UNAVAILABLE",
  RATE_LIMITED: "RATE_LIMITED",
} as const

export type SelfCheckoutErrorCode =
  (typeof SELF_CHECKOUT_ERROR_CODES)[keyof typeof SELF_CHECKOUT_ERROR_CODES]

/** Status HTTP de cada erro de negócio do auto-checkout. */
export const SELF_CHECKOUT_ERROR_STATUS: Readonly<Record<SelfCheckoutErrorCode, number>> = {
  ACCOUNT_EXISTS: 409,
  COUPON_INVALID: 422,
  CYCLE_UNAVAILABLE: 422,
  PROVIDER_UNAVAILABLE: 503,
  RATE_LIMITED: 429,
}

export class SelfCheckoutError extends Error {
  constructor(
    readonly code: SelfCheckoutErrorCode,
    message: string,
  ) {
    super(message)
    this.name = "SelfCheckoutError"
  }

  get status(): number {
    return SELF_CHECKOUT_ERROR_STATUS[this.code]
  }
}

export const SELF_CHECKOUT_BILLING_TYPES = ["PIX", "CREDIT_CARD"] as const

export type SelfCheckoutBillingType = (typeof SELF_CHECKOUT_BILLING_TYPES)[number]

export const SELF_CHECKOUT_COUPON_MAX_LENGTH = 40

/** Limite de usuários e de times adicionais por pedido. */
export const SELF_CHECKOUT_EXTRAS_MAX = 50

export const selfCheckoutRequestSchema = z.object({
  companyLegalName: z
    .string()
    .trim()
    .min(3, "Informe a razão social conforme o CNPJ.")
    .max(150, "Razão social muito longa."),
  companyTradeName: z.string().trim().max(150, "Nome fantasia muito longo.").optional(),
  cnpj: z.string().trim().min(1, "Informe o CNPJ.").refine(isValidCNPJ, "CNPJ inválido."),
  fullName: z.string().trim().min(3, "Informe seu nome completo.").max(120, "Nome muito longo."),
  email: z.string().trim().toLowerCase().email("E-mail inválido.").max(254, "E-mail muito longo."),
  phone: z
    .string()
    .trim()
    .refine((value) => {
      const digits = value.replace(/\D/g, "")
      return digits.length >= 10 && digits.length <= 13
    }, "WhatsApp inválido."),
  cycle: z.enum(SELF_CHECKOUT_CYCLES, { error: "Selecione um plano." }),
  /** Usuários adicionais (0 a 50); ausente equivale a 0. O preço vem do servidor. */
  extraUsers: z
    .number()
    .int("Quantidade de usuários inválida.")
    .min(0, "Quantidade de usuários inválida.")
    .max(SELF_CHECKOUT_EXTRAS_MAX, "Máximo de 50 usuários adicionais.")
    .optional(),
  /** Times adicionais (0 a 50); ausente equivale a 0. O preço vem do servidor. */
  extraTeams: z
    .number()
    .int("Quantidade de times inválida.")
    .min(0, "Quantidade de times inválida.")
    .max(SELF_CHECKOUT_EXTRAS_MAX, "Máximo de 50 times adicionais.")
    .optional(),
  /** Forma de pagamento escolhida; ausente equivale a PIX. */
  billingType: z.enum(SELF_CHECKOUT_BILLING_TYPES).optional(),
  /** Cupom de desconto já validado pelo servidor na tela; o servidor revalida ao criar o pedido. */
  couponCode: z.string().trim().min(1).max(SELF_CHECKOUT_COUPON_MAX_LENGTH).optional(),
  /** Declaração de que leu e concordou com Termos de Uso, Política de Privacidade e Política de Cookies da contratação. */
  termsAccepted: z.literal(true, {
    error: "Para contratar, confirme que leu e concordou com os documentos.",
  }),
  /** Honeypot: humanos não veem o campo; qualquer valor aqui descarta o pedido. */
  website: z.string().optional(),
})

export type SelfCheckoutRequest = z.infer<typeof selfCheckoutRequestSchema>

/** Ciclo exibido no seletor; valores em reais, vindos do banco a cada leitura. */
export type SelfCheckoutCycleOption = {
  cycle: SelfCheckoutCycle
  label: string
  /** Total cobrado no PIX à vista para o ciclo inteiro. */
  pixTotal: number
  /** Total do ciclo dividido pelos meses do ciclo, para comparar planos. */
  monthlyEquivalent: number
  months: number
  /** Total no cartão de crédito; ausente quando o ciclo não aceita cartão. */
  creditCardTotal?: number
  /** Total do cartão dividido pelos meses do ciclo. */
  creditCardMonthlyEquivalent?: number
  /** Máximo de parcelas no cartão (a escolha das parcelas acontece na etapa de pagamento). */
  maxInstallments?: number
  /** Valor por mês de cada usuário adicional neste ciclo; ausente quando o ciclo não tem o add-on. */
  extraUserMonthlyPrice?: number
  /** Valor por mês de cada time adicional neste ciclo; ausente quando o ciclo não tem o add-on. */
  extraTeamMonthlyPrice?: number
}

export type SelfCheckoutOptionsDTO = {
  product: { name: string; description: string | null }
  cycles: SelfCheckoutCycleOption[]
  /** Verdadeiro quando o servidor valida cupons; esconde o campo de cupom caso contrário. */
  couponsEnabled?: boolean
  /**
   * Cartão transparente do Abacate pronto para uso (chave pública presente, cartão ligado e sem kill switch);
   * `null` esconde o cartão. Os campos de cartão dos ciclos só aparecem quando isto não é nulo.
   */
  cardCheckout?: { provider: "ABACATE_PAY"; publicKey: string } | null
}

export const selfCheckoutCouponQuoteRequestSchema = z.object({
  couponCode: z
    .string()
    .trim()
    .min(1, "Informe o código do cupom.")
    .max(SELF_CHECKOUT_COUPON_MAX_LENGTH, "Cupom inválido."),
  cycle: z.enum(SELF_CHECKOUT_CYCLES, { error: "Selecione um plano." }),
  billingType: z.enum(SELF_CHECKOUT_BILLING_TYPES).optional(),
})

export type SelfCheckoutCouponQuoteRequest = z.infer<typeof selfCheckoutCouponQuoteRequestSchema>

/** Simulação do desconto de um cupom para o ciclo e a forma de pagamento escolhidos. */
export type SelfCheckoutCouponQuote = {
  /** Código normalizado pelo servidor (ex.: maiúsculas). */
  code: string
  /** Texto curto exibido ao cliente, ex.: "10% de desconto". */
  label: string
  /** Valor descontado, em reais. */
  discountAmount: number
  /** Total a pagar depois do desconto. */
  totalAfterDiscount: number
}

export type SelfCheckoutResponse = { token: string }
