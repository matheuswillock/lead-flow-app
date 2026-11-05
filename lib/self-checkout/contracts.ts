import { z } from "zod"

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
  CYCLE_UNAVAILABLE: "CYCLE_UNAVAILABLE",
  PROVIDER_UNAVAILABLE: "PROVIDER_UNAVAILABLE",
  RATE_LIMITED: "RATE_LIMITED",
} as const

export type SelfCheckoutErrorCode =
  (typeof SELF_CHECKOUT_ERROR_CODES)[keyof typeof SELF_CHECKOUT_ERROR_CODES]

/** Status HTTP de cada erro de negócio do auto-checkout. */
export const SELF_CHECKOUT_ERROR_STATUS: Readonly<Record<SelfCheckoutErrorCode, number>> = {
  ACCOUNT_EXISTS: 409,
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

export const selfCheckoutRequestSchema = z.object({
  fullName: z.string().trim().min(3, "Informe seu nome completo.").max(120, "Nome muito longo."),
  email: z.string().trim().toLowerCase().email("E-mail inválido.").max(254, "E-mail muito longo."),
  phone: z
    .string()
    .trim()
    .refine((value) => {
      const digits = value.replace(/\D/g, "")
      return digits.length >= 10 && digits.length <= 13
    }, "Celular inválido."),
  cycle: z.enum(SELF_CHECKOUT_CYCLES, { error: "Selecione um plano." }),
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
}

export type SelfCheckoutOptionsDTO = {
  product: { name: string; description: string | null }
  cycles: SelfCheckoutCycleOption[]
}

export type SelfCheckoutResponse = { token: string }
