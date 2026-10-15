export type IndefiniteBillingAccessAction =
  | "grant-indefinite"
  | "already-indefinite"
  | "excluded-valid-annual"
  | "revoke-annual-grace"

export function resolveIndefiniteBillingAccessAction(input: {
  annualSubscriptionActive: boolean
  currentGraces: Array<{ expiresAt: Date | null }>
}): IndefiniteBillingAccessAction {
  if (input.annualSubscriptionActive) {
    return input.currentGraces.length > 0 ? "revoke-annual-grace" : "excluded-valid-annual"
  }

  return input.currentGraces.some((grace) => grace.expiresAt === null)
    ? "already-indefinite"
    : "grant-indefinite"
}
