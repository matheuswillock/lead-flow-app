export interface MemberProBillingContext {
  slug: string;
  isActive: boolean;
  accessExpiresAt: Date | null;
  hasUnlimitedUsers?: boolean;
}

export interface MemberProBypassOptions {
  forceCharge?: boolean;
}
