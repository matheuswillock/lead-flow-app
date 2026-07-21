import type {
  MemberProBillingContext,
  MemberProBypassOptions,
} from "@/app/api/shared/billing/memberProBillingTypes";

export type {
  MemberProBillingContext,
  MemberProBypassOptions,
} from "@/app/api/shared/billing/memberProBillingTypes";

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
