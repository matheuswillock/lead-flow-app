export type AccountAccessRestrictionReason =
  | "banned"
  | "past_due"
  | "suspended"
  | "canceled"
  | "subscription_unavailable"

export type AccountAccessDecision =
  | { state: "allowed" }
  | { state: "restricted"; reason: AccountAccessRestrictionReason }

export type AccountAccessRecord = {
  billingOwnerId: string
  subscriptionStatus: string | null
  hasPermanentSubscription: boolean
  isBanned: boolean
}

export interface IAccountAccessDecisionRepository {
  resolveAccount(input: {
    profileId: string
    teamId?: string | null
  }): Promise<AccountAccessRecord | null>
  resolveProfileId(supabaseId: string): Promise<string | null>
}
