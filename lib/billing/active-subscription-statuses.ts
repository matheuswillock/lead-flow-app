/** Status locais que concedem acesso operacional; inadimplência bloqueia imediatamente. */
export const ACTIVE_SUBSCRIPTION_STATUSES = ["active", "trial"] as const;

export type ActiveSubscriptionStatus = (typeof ACTIVE_SUBSCRIPTION_STATUSES)[number];

export function isActiveSubscriptionStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  return (ACTIVE_SUBSCRIPTION_STATUSES as readonly string[]).includes(status);
}
