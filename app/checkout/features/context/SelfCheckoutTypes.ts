import type {
  SelfCheckoutBillingType,
  SelfCheckoutErrorCode,
  SelfCheckoutRequest,
} from "@/lib/self-checkout/contracts"

export type SelfCheckoutFieldName =
  | "cycle"
  | "companyLegalName"
  | "companyTradeName"
  | "cnpj"
  | "fullName"
  | "email"
  | "phone"
  | "termsAccepted"

/** Ordem visual dos campos; define qual recebe o foco quando há mais de um erro. */
export const SELF_CHECKOUT_FIELD_ORDER: readonly SelfCheckoutFieldName[] = [
  "cycle",
  "cnpj",
  "phone",
  "companyLegalName",
  "companyTradeName",
  "fullName",
  "email",
  "termsAccepted",
]

export type SelfCheckoutFormValues = {
  companyLegalName: string
  companyTradeName: string
  /** Valor exibido, já com máscara. */
  cnpj: string
  fullName: string
  email: string
  /** WhatsApp do representante (campo `phone` do contrato); valor exibido, já com máscara. */
  phone: string
  /** Declaração de leitura e concordância com os documentos legais. */
  termsAccepted: boolean
  /** Forma de pagamento escolhida; cartão só é oferecido quando o servidor informa o preço. */
  billingType: SelfCheckoutBillingType
  /** Cupom já validado e aplicado; vazio quando não há cupom. */
  couponCode: string
  /** Usuários adicionais na conta (0 a `SELF_CHECKOUT_EXTRAS_MAX`). */
  extraUsers: number
  /** Times adicionais na conta (0 a `SELF_CHECKOUT_EXTRAS_MAX`). */
  extraTeams: number
  /** Honeypot: humanos nunca preenchem. */
  website: string
}

/** Campos de texto livre do formulário (os demais têm controles próprios). */
export type SelfCheckoutTextFieldName =
  | "companyLegalName"
  | "companyTradeName"
  | "cnpj"
  | "fullName"
  | "email"
  | "phone"
  | "website"

export type SelfCheckoutCouponStatus = "idle" | "loading" | "applied" | "error"

export type SelfCheckoutFieldErrors = Partial<Record<SelfCheckoutFieldName, string>>

export type SelfCheckoutLoadStatus = "loading" | "ready" | "error"

export type SelfCheckoutFailureCode = SelfCheckoutErrorCode | "UNKNOWN"

export type SelfCheckoutSubmitFailure = {
  code: SelfCheckoutFailureCode
  message: string
}

export type SelfCheckoutValidationResult =
  | { ok: true; request: SelfCheckoutRequest }
  | { ok: false; errors: SelfCheckoutFieldErrors; firstInvalidField: SelfCheckoutFieldName }

export type SelfCheckoutSubmitOutcome =
  | { kind: "created"; token: string }
  | { kind: "invalid"; firstInvalidField: SelfCheckoutFieldName }
  | { kind: "failed"; failure: SelfCheckoutSubmitFailure }
  | { kind: "ignored" }
