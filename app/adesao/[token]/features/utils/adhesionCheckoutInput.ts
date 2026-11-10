import type { PublicAdhesionBillingType, PublicAdhesionCheckoutInput } from "../context/PublicAdhesionTypes"
import type { AdhesionPaymentFormValues } from "./adhesionPaymentForm"

function digits(value: string, max: number): string {
  return value.replace(/\D/g, "").slice(0, max)
}

/**
 * Corpo do pagamento da adesão. O pagador é o representante da empresa e o documento é o CNPJ.
 * No cartão vai só o token do Abacate Pay (os dados do cartão nunca passam por aqui); endereço só
 * existe no PIX legado do Asaas.
 */
export function buildAdhesionCheckoutInput(input: {
  payer: { fullName: string; email: string; phone: string; cpfCnpj: string }
  values: Pick<
    AdhesionPaymentFormValues,
    "postalCode" | "address" | "addressNumber" | "neighborhood" | "complement" | "city" | "state"
  >
  billingType: PublicAdhesionBillingType
  installments: number
  /** Token `ctok_` do abacatepay.js; obrigatório no cartão. */
  cardToken?: string | null
}): PublicAdhesionCheckoutInput {
  const { payer, values, billingType, installments, cardToken } = input
  return {
    fullName: payer.fullName.trim(),
    email: payer.email.trim(),
    phone: digits(payer.phone, 11),
    cpfCnpj: digits(payer.cpfCnpj, 14),
    postalCode: digits(values.postalCode, 8),
    address: values.address.trim(),
    addressNumber: values.addressNumber.trim(),
    neighborhood: values.neighborhood.trim(),
    complement: values.complement.trim() || null,
    city: values.city.trim(),
    state: values.state.trim(),
    billingType,
    installments,
    ...(billingType === "CREDIT_CARD" && cardToken ? { cardToken } : {}),
  }
}
