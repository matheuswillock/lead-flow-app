export type AccountAccessRestrictionReason =
  | "banned"
  | "past_due"
  | "suspended"
  | "canceled"
  | "subscription_unavailable"

export type AccountAccessDecision =
  | { state: "allowed" }
  | {
      state: "restricted"
      reason: AccountAccessRestrictionReason
      isBillingOwner?: boolean
      canRecoverCard?: boolean
    }

export type AccountAccessRecord = {
  billingOwnerId: string
  subscriptionStatus: string | null
  subscriptionNextDueDate?: Date | null
  hasPermanentSubscription: boolean
  isBanned: boolean
  canRecoverCard?: boolean
}

export interface IAccountAccessDecisionRepository {
  resolveAccount(input: {
    profileId: string
    teamId?: string | null
  }): Promise<AccountAccessRecord | null>
  resolveProfileId(supabaseId: string): Promise<string | null>
  resolveTeamMasterProfileId?(teamId: string): Promise<string | null>
}
