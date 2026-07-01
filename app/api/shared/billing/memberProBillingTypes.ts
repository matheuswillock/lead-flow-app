export interface MemberProBillingContext {
  slug: string;
  isActive: boolean;
  accessExpiresAt: Date | null;
}

export interface MemberProBypassOptions {
  forceCharge?: boolean;
}
