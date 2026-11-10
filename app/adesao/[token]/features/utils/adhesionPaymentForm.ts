/**
 * Formulário do pagamento da adesão: representante e, só no PIX legado do Asaas, endereço de
 * cobrança. Os dados do cartão ficam no formulário seguro do Abacate Pay, fora deste estado.
 */
export type AdhesionPaymentFormValues = {
  fullName: string
  email: string
  /** WhatsApp do representante; valor exibido, já com máscara. */
  phone: string
  postalCode: string
  address: string
  addressNumber: string
  neighborhood: string
  complement: string
  city: string
  state: string
  installments: number
}

export type AdhesionPaymentFieldName = Exclude<keyof AdhesionPaymentFormValues, "installments">

export type AdhesionPaymentFieldErrors = Partial<Record<AdhesionPaymentFieldName, string>>

/** Ordem visual dos campos; define qual recebe o foco quando há mais de um erro. */
export const ADHESION_PAYMENT_FIELD_ORDER: readonly AdhesionPaymentFieldName[] = [
  "fullName",
  "email",
  "phone",
  "postalCode",
  "addressNumber",
  "address",
  "neighborhood",
  "city",
  "state",
]

export function initialAdhesionPaymentValues(prefill: {
  fullName: string
  email: string
  phone: string
}): AdhesionPaymentFormValues {
  return {
    ...prefill,
    postalCode: "",
    address: "",
    addressNumber: "",
    neighborhood: "",
    complement: "",
    city: "",
    state: "",
    installments: 1,
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function digitsOf(value: string): string {
  return value.replace(/\D/g, "")
}

export function validateAdhesionPaymentForm(
  values: AdhesionPaymentFormValues,
  options: {
    needsAddress: boolean
    /** Falso quando o representante já foi validado em outra parte da tela (dados da empresa). */
    includePayer?: boolean
  },
): AdhesionPaymentFieldErrors {
  const errors: AdhesionPaymentFieldErrors = {}

  if (options.includePayer !== false) {
    if (values.fullName.trim().length < 2) errors.fullName = "Informe o nome completo."
    if (!EMAIL_RE.test(values.email.trim())) errors.email = "E-mail inválido."
    const phoneDigits = digitsOf(values.phone)
    if (phoneDigits.length < 10 || phoneDigits.length > 13) errors.phone = "WhatsApp inválido."
  }

  if (options.needsAddress) {
    if (digitsOf(values.postalCode).length !== 8) errors.postalCode = "Informe um CEP válido."
    if (values.addressNumber.trim().length === 0) errors.addressNumber = "Informe o número."
    if (values.address.trim().length < 2) errors.address = "Informe o endereço."
    if (values.neighborhood.trim().length < 2) errors.neighborhood = "Informe o bairro."
    if (values.city.trim().length < 2) errors.city = "Informe a cidade."
    if (values.state.trim().length !== 2) errors.state = "UF inválida."
  }

  return errors
}

export function firstInvalidAdhesionField(
  errors: AdhesionPaymentFieldErrors,
): AdhesionPaymentFieldName | null {
  return ADHESION_PAYMENT_FIELD_ORDER.find((field) => errors[field]) ?? null
}
