export interface MemberProBillingContext {
  slug: string;
  isActive: boolean;
  accessExpiresAt: Date | null;
}

export interface MemberProBypassOptions {
  forceCharge?: boolean;
}

export interface IMemberProBillingService {
  getMemberProContext(masterId: string): Promise<MemberProBillingContext>;
  isMemberProDeferredBillingActive(masterId: string): Promise<boolean>;
  shouldBypassIncrementalCharge(
    masterId: string,
    options?: MemberProBypassOptions
  ): Promise<boolean>;
  syncUsageToSubscription(masterId: string, reason: string): Promise<void>;
  syncBillingAfterUsageChange(masterId: string, reason: string): Promise<void>;
}
