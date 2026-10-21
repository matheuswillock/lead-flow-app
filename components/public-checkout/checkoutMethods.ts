import { normalizeAvailableBillingTypes } from "@/lib/payment-methods/availability-client"
import type { AvailableBillingTypes } from "@/lib/payment-methods/availability"

import type { PublicCheckoutBillingType } from "./publicCheckoutTypes"

export function resolveCheckoutMethods(input: {
  availableMethods?: AvailableBillingTypes
  /** Legado: força PIX e dispensa endereço. */
  pixOnly?: boolean
}): AvailableBillingTypes {
  if (input.pixOnly) return ["PIX"]
  return normalizeAvailableBillingTypes(input.availableMethods)
}

/** Escolhe o método inicial sem nunca pré-selecionar um método indisponível. */
export function pickBillingType(
  preset: PublicCheckoutBillingType | null | undefined,
  methods: AvailableBillingTypes
): PublicCheckoutBillingType {
  if (preset && methods.includes(preset)) return preset
  return methods.includes("PIX") ? "PIX" : (methods[0] ?? "PIX")
}
