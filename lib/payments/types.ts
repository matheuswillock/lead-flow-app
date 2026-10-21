export const PAYMENT_COHORTS = ["ASAAS", "ROUTER"] as const
export type PaymentCohort = (typeof PAYMENT_COHORTS)[number]

export const CHARGE_PURPOSES = [
  "SUBSCRIPTION_RENEWAL",
  "ADD_USER",
  "ADD_TEAM",
  "CREDITS",
  "CHANGE_ORDER",
  "BACKOFFICE_CHARGE",
  "ADHESION",
  "GRACE",
  "PLATFORM_PURCHASE",
] as const
export type ChargePurpose = (typeof CHARGE_PURPOSES)[number]

/** ROUTER: criada pelo PaymentProviderRouter. ASAAS_SHADOW: espelho de um evento do Asaas. MIRROR: espelho de um dono já neutro. */
export const CHARGE_SOURCES = ["ROUTER", "ASAAS_SHADOW", "MIRROR"] as const
export type ChargeSource = (typeof CHARGE_SOURCES)[number]

export function isPaymentCohort(value: unknown): value is PaymentCohort {
  return typeof value === "string" && (PAYMENT_COHORTS as readonly string[]).includes(value)
}

export function isChargePurpose(value: unknown): value is ChargePurpose {
  return typeof value === "string" && (CHARGE_PURPOSES as readonly string[]).includes(value)
}
