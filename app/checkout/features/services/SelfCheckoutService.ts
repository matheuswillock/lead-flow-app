import { ApiRequestError } from "@/lib/http/api-request-error"
import { API_CLIENT_BASE } from "@/lib/route-map"
import {
  SELF_CHECKOUT_CYCLES,
  SELF_CHECKOUT_ERROR_STATUS,
  SelfCheckoutError,
  type SelfCheckoutCycleOption,
  type SelfCheckoutErrorCode,
  type SelfCheckoutOptionsDTO,
  type SelfCheckoutRequest,
  type SelfCheckoutResponse,
} from "@/lib/self-checkout/contracts"
import type { ISelfCheckoutService } from "./ISelfCheckoutService"

export const SELF_CHECKOUT_URL = `${API_CLIENT_BASE}/public-self-checkout` as const
export const SELF_CHECKOUT_OPTIONS_URL = `${SELF_CHECKOUT_URL}/options` as const

const OPTIONS_ERROR = "Não foi possível carregar os planos."
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

function errorCodeForStatus(status: number): SelfCheckoutErrorCode | null {
  const entry = Object.entries(SELF_CHECKOUT_ERROR_STATUS).find(([, value]) => value === status)
  return entry ? (entry[0] as SelfCheckoutErrorCode) : null
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
  return {
    product: {
      name: candidate.product.name,
      description: typeof description === "string" && description.trim() ? description : null,
    },
    cycles: candidate.cycles.filter(isCycleOption),
  }
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

  async create(request: SelfCheckoutRequest): Promise<SelfCheckoutResponse> {
    const response = await this.fetcher(SELF_CHECKOUT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    })
    const envelope = await readEnvelope<{ token?: unknown }>(response)

    if (!response.ok || envelope.isValid === false) {
      const message = firstMessage(envelope, CREATE_ERROR)
      const code = errorCodeForStatus(response.status)
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
