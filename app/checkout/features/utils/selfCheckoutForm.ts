import { isApiRequestError } from "@/lib/http/api-request-error"
import { formatDocumentInput, normalizeLeadPhoneDigits, unmask } from "@/lib/masks"
import {
  SelfCheckoutError,
  selfCheckoutRequestSchema,
  type SelfCheckoutBillingType,
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
  companyLegalName: "",
  companyTradeName: "",
  cnpj: "",
  fullName: "",
  email: "",
  phone: "",
  termsAccepted: false,
  billingType: "PIX",
  couponCode: "",
  extraUsers: 0,
  extraTeams: 0,
  website: "",
}

export const GENERIC_SUBMIT_MESSAGE = "Não foi possível continuar. Tente novamente."

const FAILURE_MESSAGES: Record<SelfCheckoutErrorCode, string> = {
  ACCOUNT_EXISTS: "Já existe uma conta com este e-mail.",
  RATE_LIMITED: "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
  PROVIDER_UNAVAILABLE: "Pagamento temporariamente indisponível. Tente novamente em instantes.",
  CYCLE_UNAVAILABLE: "Este plano não está mais disponível. Escolha outro plano.",
  COUPON_INVALID: "Este cupom não pode ser aplicado. Confira o código.",
}

const roundMoney = (value: number) => Math.round(value * 100) / 100

/** O plano anual dá usuários ilimitados, sem cobrança de usuário adicional. */
export function hasUnlimitedUsers(option: Pick<SelfCheckoutCycleOption, "cycle">): boolean {
  return option.cycle === "annual"
}

export type SelfCheckoutOrderAmounts = {
  isCard: boolean
  /** Valor do plano na forma de pagamento escolhida, sem adicionais. */
  planTotal: number
  /** Total dos usuários adicionais no ciclo inteiro. */
  extraUsersTotal: number
  /** Total dos times adicionais no ciclo inteiro. */
  extraTeamsTotal: number
  /** Adicionais no ciclo inteiro (usuários + times). */
  extrasTotal: number
  /** Plano mais adicionais diluídos nos meses do ciclo, na forma de pagamento escolhida. */
  monthlyEquivalent: number
  /** Plano mais adicionais no ciclo inteiro, antes de cupom. */
  total: number
}

/**
 * Valores do pedido na tela. Cada adicional tem preço único para o período contratado (o mesmo no
 * PIX e no cartão): total = valor do plano + preço dos adicionais, que pode ser parcelado como o plano.
 */
export function computeOrderAmounts(
  option: SelfCheckoutCycleOption,
  billingType: SelfCheckoutBillingType,
  extras: { extraUsers: number; extraTeams: number },
): SelfCheckoutOrderAmounts {
  const isCard = billingType === "CREDIT_CARD" && Boolean(option.creditCardTotal)
  const planTotal = isCard ? (option.creditCardTotal ?? option.pixTotal) : option.pixTotal
  const planMonthly = isCard
    ? (option.creditCardMonthlyEquivalent ?? option.monthlyEquivalent)
    : option.monthlyEquivalent
  const users = hasUnlimitedUsers(option) ? 0 : Math.max(0, Math.trunc(extras.extraUsers))
  const teams = Math.max(0, Math.trunc(extras.extraTeams))
  // O preço do adicional vale pelo período contratado inteiro (não é mensal).
  const extraUsersTotal = roundMoney(users * (option.extraUserMonthlyPrice ?? 0))
  const extraTeamsTotal = roundMoney(teams * (option.extraTeamMonthlyPrice ?? 0))
  const extrasTotal = roundMoney(extraUsersTotal + extraTeamsTotal)
  const months = Math.max(1, option.months)
  const total = roundMoney(planTotal + extrasTotal)
  return {
    isCard,
    planTotal,
    extraUsersTotal,
    extraTeamsTotal,
    extrasTotal,
    monthlyEquivalent: extrasTotal > 0 ? roundMoney(total / months) : planMonthly,
    total,
  }
}

/** Textos vindos do cadastro do produto podem trazer travessão; na tela ele vira vírgula. */
export function withoutDashes(text: string): string {
  return text
    .replace(/\s+[—–]\s+/g, ", ")
    .replace(/[—–]/g, "-")
}

/** 12.345.678/0001-95, limitado a 14 dígitos. */
export function maskCnpjInput(value: string): string {
  return formatDocumentInput(unmask(value).slice(0, 14))
}

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })

export function formatBRL(value: number): string {
  return BRL.format(value)
}

/** O plano anual vem pré-selecionado; se ele não estiver disponível, vale o primeiro ciclo da API. */
export function pickDefaultCycle(cycles: readonly SelfCheckoutCycleOption[]): SelfCheckoutCycle | null {
  return cycles.find((option) => option.cycle === "annual")?.cycle ?? cycles[0]?.cycle ?? null
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
  const extraUsers = cycle === "annual" ? 0 : values.extraUsers
  const parsed = selfCheckoutRequestSchema.safeParse({
    companyLegalName: values.companyLegalName,
    ...(values.companyTradeName.trim() ? { companyTradeName: values.companyTradeName } : {}),
    cnpj: values.cnpj,
    fullName: values.fullName,
    email: values.email,
    phone: values.phone,
    cycle: cycle ?? undefined,
    // PIX é o padrão do servidor: só enviamos a forma de pagamento quando ela muda o pedido.
    ...(values.billingType === "CREDIT_CARD" ? { billingType: values.billingType } : {}),
    ...(values.couponCode ? { couponCode: values.couponCode } : {}),
    // Adicionais só vão no pedido quando há pelo menos um; o preço é sempre o do servidor.
    ...(extraUsers > 0 ? { extraUsers } : {}),
    ...(values.extraTeams > 0 ? { extraTeams: values.extraTeams } : {}),
    termsAccepted: values.termsAccepted,
    website: values.website,
  })

  if (parsed.success) {
    return {
      ok: true,
      request: {
        ...parsed.data,
        cnpj: unmask(parsed.data.cnpj),
        phone: normalizeLeadPhoneDigits(parsed.data.phone),
      },
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
