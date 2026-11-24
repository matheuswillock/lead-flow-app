import type { CheckoutPhase } from "@/components/checkout/checkoutPhases"

import type { PublicCheckoutPayerPrefill } from "./publicCheckoutTypes"

/** Campos do pagador que a fase Pagamento valida. O complemento é opcional e fica fora. */
export const PAYMENT_FIELDS = [
  "fullName",
  "email",
  "phone",
  "cpfCnpj",
  "postalCode",
  "addressNumber",
  "address",
  "neighborhood",
  "city",
  "state",
] as const

export type PaymentFieldName = (typeof PAYMENT_FIELDS)[number]
export type PaymentFieldErrors = Partial<Record<PaymentFieldName, string>>

/** Resumo mostra o plano e não valida campos; Pagamento valida os dados do pagador. */
export const PUBLIC_CHECKOUT_PHASES: readonly CheckoutPhase[] = [
  { label: "Resumo", fields: [] },
  { label: "Pagamento", fields: PAYMENT_FIELDS },
]

const onlyDigits = (value: string) => value.replace(/\D/g, "")

/** Valida os dados do pagador. Endereço só entra quando o fluxo o exige (não é PIX do Abacate). */
export function validatePaymentForm(
  form: PublicCheckoutPayerPrefill,
  options: { requiresAddress: boolean; cepResolved: boolean },
): PaymentFieldErrors {
  const errors: PaymentFieldErrors = {}

  if (form.fullName.trim().length < 2) errors.fullName = "Informe seu nome completo."
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errors.email = "Informe um e-mail válido."
  if (onlyDigits(form.phone).length < 10) errors.phone = "Informe um telefone com DDD."
  const taxIdLength = onlyDigits(form.cpfCnpj).length
  if (taxIdLength !== 11 && taxIdLength !== 14) errors.cpfCnpj = "Informe um CPF ou CNPJ válido."

  if (options.requiresAddress) {
    const cep = onlyDigits(form.postalCode)
    if (cep.length !== 8) errors.postalCode = "Informe um CEP válido."
    else if (!options.cepResolved) errors.postalCode = "Não encontramos este CEP."
    if (form.addressNumber.trim().length === 0) errors.addressNumber = "Informe o número."
    if (form.address.trim().length <= 1) errors.address = "Informe o endereço."
    if (form.neighborhood.trim().length <= 1) errors.neighborhood = "Informe o bairro."
    if (form.city.trim().length <= 1) errors.city = "Informe a cidade."
    if (form.state.trim().length !== 2) errors.state = "Informe a UF com 2 letras."
  }

  return errors
}

/** Primeiro campo com erro, na ordem em que aparece no formulário: é para ele que o foco vai. */
export function firstPaymentField(errors: PaymentFieldErrors): PaymentFieldName | null {
  return PAYMENT_FIELDS.find((field) => Boolean(errors[field])) ?? null
}
