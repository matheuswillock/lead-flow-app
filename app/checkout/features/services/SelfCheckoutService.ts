import { ApiRequestError } from "@/lib/http/api-request-error"
import { API_CLIENT_BASE } from "@/lib/route-map"
import {
  SELF_CHECKOUT_CYCLES,
  SELF_CHECKOUT_ERROR_STATUS,
  SelfCheckoutError,
  type SelfCheckoutCouponQuote,
  type SelfCheckoutCouponQuoteRequest,
  type SelfCheckoutCycleOption,
  type SelfCheckoutErrorCode,
  type SelfCheckoutOptionsDTO,
  type SelfCheckoutRequest,
  type SelfCheckoutResponse,
} from "@/lib/self-checkout/contracts"
import { CnpjService, type CompanyLookup } from "@/lib/services/CnpjService"
import type { ISelfCheckoutService } from "./ISelfCheckoutService"

export const SELF_CHECKOUT_URL = `${API_CLIENT_BASE}/public-self-checkout` as const
export const SELF_CHECKOUT_OPTIONS_URL = `${SELF_CHECKOUT_URL}/options` as const
export const SELF_CHECKOUT_COUPON_URL = `${SELF_CHECKOUT_URL}/coupon` as const

const OPTIONS_ERROR = "Não foi possível carregar os planos."
const COUPON_ERROR = "Não foi possível validar o cupom. Tente novamente."
const CREATE_ERROR = "Não foi possível continuar. Tente novamente."

type OutputEnvelope<T> = {
  isValid?: boolean
  errorMessages?: string[]
  result?: T
}

async function readEnvelope<T>(response: Response): Promise<OutputEnvelope<T>> {
  try {
    return (await response.json()) as OutputEnvelope<T>
  } catch {
    return {}
  }
}

function firstMessage(envelope: OutputEnvelope<unknown>, fallback: string): string {
  const message = envelope.errorMessages?.find((item) => typeof item === "string" && item.trim())
  return message ?? fallback
}

/**
 * O código do servidor (`result.code`) vale mais que o status: cupom inválido e plano indisponível
 * dividem o 422, então só o código distingue os dois. Sem código, o status mapeia o erro e o 422
 * continua significando plano indisponível.
 */
function errorCodeFor(status: number, serverCode: unknown): SelfCheckoutErrorCode | null {
  const known = Object.keys(SELF_CHECKOUT_ERROR_STATUS) as SelfCheckoutErrorCode[]
  if (typeof serverCode === "string" && (known as string[]).includes(serverCode)) {
    return serverCode as SelfCheckoutErrorCode
  }
  return known.find((code) => code !== "COUPON_INVALID" && SELF_CHECKOUT_ERROR_STATUS[code] === status) ?? null
}

function isCycleOption(value: unknown): value is SelfCheckoutCycleOption {
  if (!value || typeof value !== "object") return false
  const option = value as Partial<SelfCheckoutCycleOption>
  return (
    (SELF_CHECKOUT_CYCLES as readonly unknown[]).includes(option.cycle) &&
    typeof option.label === "string" &&
    typeof option.pixTotal === "number" &&
    Number.isFinite(option.pixTotal) &&
    typeof option.monthlyEquivalent === "number" &&
    Number.isFinite(option.monthlyEquivalent) &&
    typeof option.months === "number" &&
    Number.isFinite(option.months)
  )
}

function parseOptions(result: unknown): SelfCheckoutOptionsDTO {
  const candidate = result as Partial<SelfCheckoutOptionsDTO> | undefined
  if (!candidate?.product || typeof candidate.product.name !== "string" || !Array.isArray(candidate.cycles)) {
    throw new ApiRequestError(OPTIONS_ERROR)
  }
  const description = candidate.product.description
  const cardCheckout = parseCardCheckout(candidate.cardCheckout)
  return {
    product: {
      name: candidate.product.name,
      description: typeof description === "string" && description.trim() ? description : null,
    },
    // Sem o formulário seguro do Abacate não há como cobrar cartão: os preços de cartão saem.
    cycles: candidate.cycles
      .filter(isCycleOption)
      .map((option) => (cardCheckout ? withValidCardFields(option) : withoutCardFields(option))),
    couponsEnabled: candidate.couponsEnabled === true,
    cardCheckout,
  }
}

function withoutCardFields(option: SelfCheckoutCycleOption): SelfCheckoutCycleOption {
  const { creditCardTotal: _total, creditCardMonthlyEquivalent: _monthly, maxInstallments: _max, ...base } = option
  return base
}

/** Cartão só existe com a chave pública do Abacate Pay (formulário seguro); sem ela, só PIX. */
function parseCardCheckout(value: unknown): SelfCheckoutOptionsDTO["cardCheckout"] {
  if (!value || typeof value !== "object") return null
  const candidate = value as { provider?: unknown; publicKey?: unknown }
  if (candidate.provider !== "ABACATE_PAY") return null
  if (typeof candidate.publicKey !== "string" || !candidate.publicKey.trim()) return null
  return { provider: "ABACATE_PAY", publicKey: candidate.publicKey }
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
}

/** Só mantém os campos de cartão quando completos; um ciclo parcial cai para PIX apenas. */
function withValidCardFields(option: SelfCheckoutCycleOption): SelfCheckoutCycleOption {
  const { creditCardTotal, creditCardMonthlyEquivalent, maxInstallments, ...base } = option
  if (!isPositiveNumber(creditCardTotal) || !isPositiveNumber(creditCardMonthlyEquivalent)) return base
  return {
    ...base,
    creditCardTotal,
    creditCardMonthlyEquivalent,
    ...(isPositiveNumber(maxInstallments) ? { maxInstallments } : {}),
  }
}

function isCouponQuote(value: unknown): value is SelfCheckoutCouponQuote {
  if (!value || typeof value !== "object") return false
  const quote = value as Partial<SelfCheckoutCouponQuote>
  return (
    typeof quote.code === "string" &&
    quote.code.length > 0 &&
    typeof quote.label === "string" &&
    typeof quote.discountAmount === "number" &&
    Number.isFinite(quote.discountAmount) &&
    typeof quote.totalAfterDiscount === "number" &&
    Number.isFinite(quote.totalAfterDiscount)
  )
}

type Fetcher = (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => Promise<Response>

export class SelfCheckoutService implements ISelfCheckoutService {
  constructor(private readonly fetcher: Fetcher = (input, init) => fetch(input, init)) {}

  async getOptions(): Promise<SelfCheckoutOptionsDTO> {
    const response = await this.fetcher(SELF_CHECKOUT_OPTIONS_URL, { cache: "no-store" })
    const envelope = await readEnvelope<unknown>(response)
    if (!response.ok || envelope.isValid === false || envelope.result === undefined) {
      throw new ApiRequestError(firstMessage(envelope, OPTIONS_ERROR), response.status)
    }
    return parseOptions(envelope.result)
  }

  async quoteCoupon(request: SelfCheckoutCouponQuoteRequest): Promise<SelfCheckoutCouponQuote> {
    const response = await this.fetcher(SELF_CHECKOUT_COUPON_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    })
    const envelope = await readEnvelope<unknown>(response)
    if (!response.ok || envelope.isValid === false || !isCouponQuote(envelope.result)) {
      throw new ApiRequestError(firstMessage(envelope, COUPON_ERROR), response.status)
    }
    return envelope.result
  }

  async lookupCompany(cnpj: string): Promise<CompanyLookup | null> {
    return CnpjService.consultar(cnpj, this.fetcher)
  }

  async create(request: SelfCheckoutRequest): Promise<SelfCheckoutResponse> {
    const response = await this.fetcher(SELF_CHECKOUT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    })
    const envelope = await readEnvelope<{ token?: unknown; code?: unknown }>(response)

    if (!response.ok || envelope.isValid === false) {
      const message = firstMessage(envelope, CREATE_ERROR)
      const code = errorCodeFor(response.status, envelope.result?.code)
      if (code) throw new SelfCheckoutError(code, message)
      throw new ApiRequestError(message, response.status)
    }

    const token = envelope.result?.token
    if (typeof token !== "string" || !token) {
      throw new ApiRequestError(CREATE_ERROR, response.status)
    }
    return { token }
  }
}
