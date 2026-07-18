import crypto from "crypto";

export type BethaniaAiConfiguration = {
  enabled: boolean;
  shadowMode: boolean;
  rolloutPercentage: number;
  dailyUserLimit: number;
  dailyGlobalLimit: number;
  timeoutMs: number;
  circuitBreakerFailureThreshold: number;
  circuitBreakerResetSeconds: number;
  primaryModel: string;
  fallbackModel: string | null;
};

/** Deterministic rollout prevents a user moving in and out of a cohort. */
export function isBethaniaAiUserEligible(userLinkId: string, rolloutPercentage: number): boolean {
  if (rolloutPercentage <= 0) return false;
  if (rolloutPercentage >= 100) return true;
  // Use the first 32 bits as a fraction of its entire range. Modulo 100 would
  // over-assign the first 56 buckets because 2^32 is not divisible by 100.
  const value = crypto.createHash("sha256").update(userLinkId).digest().readUInt32BE(0);
  return (value / 0x1_0000_0000) * 100 < rolloutPercentage;
}

/** No provider call is allowed until every local gate passes. */
export function mayCallBethaniaAi(
  configuration: BethaniaAiConfiguration,
  userLinkId: string,
  usage: { userRequests: number; globalRequests: number },
  circuitOpen: boolean
): boolean {
  return (
    configuration.enabled &&
    isBethaniaAiUserEligible(userLinkId, configuration.rolloutPercentage) &&
    usage.userRequests < configuration.dailyUserLimit &&
    usage.globalRequests < configuration.dailyGlobalLimit &&
    !circuitOpen
  );
}
