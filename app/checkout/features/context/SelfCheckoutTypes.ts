import type {
  SelfCheckoutErrorCode,
  SelfCheckoutRequest,
} from "@/lib/self-checkout/contracts"

export type SelfCheckoutFieldName = "cycle" | "fullName" | "email" | "phone"

/** Ordem visual dos campos; define qual recebe o foco quando há mais de um erro. */
export const SELF_CHECKOUT_FIELD_ORDER: readonly SelfCheckoutFieldName[] = [
  "cycle",
  "fullName",
  "email",
  "phone",
]

export type SelfCheckoutFormValues = {
  fullName: string
  email: string
  /** Valor exibido, já com máscara. */
  phone: string
  /** Honeypot: humanos nunca preenchem. */
  website: string
}

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
