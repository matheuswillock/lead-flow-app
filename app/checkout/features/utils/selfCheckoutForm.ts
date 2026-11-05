import { isApiRequestError } from "@/lib/http/api-request-error"
import { normalizeLeadPhoneDigits } from "@/lib/masks"
import {
  SelfCheckoutError,
  selfCheckoutRequestSchema,
  type SelfCheckoutCycle,
  type SelfCheckoutCycleOption,
  type SelfCheckoutErrorCode,
} from "@/lib/self-checkout/contracts"
import {
  SELF_CHECKOUT_FIELD_ORDER,
  type SelfCheckoutFieldErrors,
  type SelfCheckoutFieldName,
  type SelfCheckoutFormValues,
  type SelfCheckoutSubmitFailure,
  type SelfCheckoutValidationResult,
} from "../context/SelfCheckoutTypes"

export const INITIAL_FORM_VALUES: SelfCheckoutFormValues = {
  fullName: "",
  email: "",
  phone: "",
  website: "",
}

export const GENERIC_SUBMIT_MESSAGE = "Não foi possível continuar. Tente novamente."

const FAILURE_MESSAGES: Record<SelfCheckoutErrorCode, string> = {
  ACCOUNT_EXISTS: "Já existe uma conta com este e-mail.",
  RATE_LIMITED: "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
  PROVIDER_UNAVAILABLE: "Pagamento temporariamente indisponível. Tente novamente em instantes.",
  CYCLE_UNAVAILABLE: "Este plano não está mais disponível. Escolha outro plano.",
}

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })

export function formatBRL(value: number): string {
  return BRL.format(value)
}

/** O primeiro ciclo devolvido pela API; a ordem é decisão do backend, sem destaque inventado. */
export function pickDefaultCycle(cycles: readonly SelfCheckoutCycleOption[]): SelfCheckoutCycle | null {
  return cycles[0]?.cycle ?? null
}

/** Mantém a escolha atual enquanto o ciclo continuar na lista; senão volta ao padrão. */
export function resolveSelectedCycle(
  cycles: readonly SelfCheckoutCycleOption[],
  current: SelfCheckoutCycle | null,
): SelfCheckoutCycle | null {
  if (current && cycles.some((option) => option.cycle === current)) return current
  return pickDefaultCycle(cycles)
}

function isSelfCheckoutField(value: unknown): value is SelfCheckoutFieldName {
  return typeof value === "string" && (SELF_CHECKOUT_FIELD_ORDER as readonly string[]).includes(value)
}

export function validateSelfCheckoutForm(
  values: SelfCheckoutFormValues,
  cycle: SelfCheckoutCycle | null,
): SelfCheckoutValidationResult {
  const parsed = selfCheckoutRequestSchema.safeParse({
    fullName: values.fullName,
    email: values.email,
    phone: values.phone,
    cycle: cycle ?? undefined,
    website: values.website,
  })

  if (parsed.success) {
    return {
      ok: true,
      request: { ...parsed.data, phone: normalizeLeadPhoneDigits(parsed.data.phone) },
    }
  }

  const errors: SelfCheckoutFieldErrors = {}
  for (const issue of parsed.error.issues) {
    const field = issue.path[0]
    if (isSelfCheckoutField(field) && !errors[field]) errors[field] = issue.message
  }

  const firstInvalidField = SELF_CHECKOUT_FIELD_ORDER.find((field) => errors[field])
  if (!firstInvalidField) {
    // Erro fora dos campos exibidos (ex.: honeypot malformado): trate como ciclo inválido.
    return { ok: false, errors: { cycle: "Selecione um plano." }, firstInvalidField: "cycle" }
  }
  return { ok: false, errors, firstInvalidField }
}

export function describeSubmitFailure(error: unknown): SelfCheckoutSubmitFailure {
  if (error instanceof SelfCheckoutError) {
    return { code: error.code, message: FAILURE_MESSAGES[error.code] }
  }
  if (isApiRequestError(error) && error.message.trim()) {
    return { code: "UNKNOWN", message: error.message }
  }
  return { code: "UNKNOWN", message: GENERIC_SUBMIT_MESSAGE }
}
