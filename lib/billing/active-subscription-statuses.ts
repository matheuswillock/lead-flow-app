/** Status locais que concedem acesso (Estágio 8 / D8). */
export const ACTIVE_SUBSCRIPTION_STATUSES = ["active", "trial", "past_due"] as const;

export type ActiveSubscriptionStatus = (typeof ACTIVE_SUBSCRIPTION_STATUSES)[number];

export function isActiveSubscriptionStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  return (ACTIVE_SUBSCRIPTION_STATUSES as readonly string[]).includes(status);
}
