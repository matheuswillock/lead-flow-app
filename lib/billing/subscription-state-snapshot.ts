// Porte do PR #902 (fechado sem merge) — 20 — Assinaturas — Backend E1.
// Payload autocontido (sem referência a tipos do Prisma) para que o snapshot
// sobreviva independente de mudanças futuras no schema relacional (DA1).
export const SUBSCRIPTION_STATE_SNAPSHOT_SCHEMA_VERSION = "1";

export type SubscriptionStateSnapshotSource = {
  profile: {
    id: string;
    email: string;
    supabaseId: string | null;
    fullName: string | null;
    isMaster: boolean;
    hasPermanentSubscription: boolean;
    hasUnlimitedUsers: boolean;
    asaasCustomerId: string | null;
    asaasSubscriptionId: string | null;
    subscriptionId: string | null;
    subscriptionStatus: string | null;
    subscriptionPlan: string | null;
    subscriptionCycle: string | null;
    subscriptionStartDate: Date | null;
    subscriptionEndDate: Date | null;
    subscriptionNextDueDate: Date | null;
    trialEndDate: Date | null;
    operatorCount: number;
  };
  subscription: {
    id: string;
    adhesionId: string | null;
    productId: string | null;
    asaasSubscriptionId: string | null;
    asaasInstallmentId: string | null;
    subscriptionStatus: string | null;
    subscriptionPlan: string | null;
    subscriptionCycle: string | null;
    subscriptionStartDate: Date | null;
    subscriptionEndDate: Date | null;
    subscriptionNextDueDate: Date | null;
    trialEndDate: Date | null;
    hasPermanentSubscription: boolean;
    product: {
      id: string;
      name: string;
      type: string;
      isActive: boolean;
      featureSlugs: string[];
    } | null;
    adhesion: {
      id: string;
      status: string;
      cycle: string;
      totalAmount: string;
      monthlyTotalAmount: string;
      productId: string | null;
      asaasCustomerId: string | null;
      asaasPaymentId: string | null;
      asaasInstallmentId: string | null;
      negotiatedTotalAmount: string | null;
      billingType: string | null;
    } | null;
    capacity: {
      includedExtraTeams: number;
      includedExtraUsers: number;
      manualAdjustmentExtraTeams: number;
      manualAdjustmentExtraUsers: number;
    } | null;
  } | null;
  userType: {
    slug: string;
    name: string;
    accessStartsAt: Date | null;
    accessExpiresAt: Date | null;
  } | null;
  entitlements: Array<{
    slug: string;
    name: string;
    grantType: string;
    accessLevel: string;
  }>;
};

type SnapshotIsoDates = {
  subscriptionStartDate: string | null;
  subscriptionEndDate: string | null;
  subscriptionNextDueDate: string | null;
  trialEndDate: string | null;
};

export type SubscriptionStateSnapshotPayload = {
  schemaVersion: string;
  profile: Omit<SubscriptionStateSnapshotSource["profile"], keyof SnapshotIsoDates> &
    SnapshotIsoDates;
  subscription: {
    id: string;
    adhesionId: string | null;
    productId: string | null;
    asaasSubscriptionId: string | null;
    asaasInstallmentId: string | null;
    subscriptionStatus: string | null;
    subscriptionPlan: string | null;
    subscriptionCycle: string | null;
    subscriptionStartDate: string | null;
    subscriptionEndDate: string | null;
    subscriptionNextDueDate: string | null;
    trialEndDate: string | null;
    hasPermanentSubscription: boolean;
  } | null;
  product: NonNullable<
    NonNullable<SubscriptionStateSnapshotSource["subscription"]>["product"]
  > | null;
  adhesion: NonNullable<
    NonNullable<SubscriptionStateSnapshotSource["subscription"]>["adhesion"]
  > | null;
  capacity: NonNullable<
    NonNullable<SubscriptionStateSnapshotSource["subscription"]>["capacity"]
  > | null;
  userType: {
    slug: string;
    name: string;
    accessStartsAt: string | null;
    accessExpiresAt: string | null;
  } | null;
  entitlements: SubscriptionStateSnapshotSource["entitlements"];
};

function toIso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

export function assembleSubscriptionStateSnapshot(
  source: SubscriptionStateSnapshotSource,
): SubscriptionStateSnapshotPayload {
  const profile = source.profile;
  const subscription = source.subscription;

  return {
    schemaVersion: SUBSCRIPTION_STATE_SNAPSHOT_SCHEMA_VERSION,
    profile: {
      ...profile,
      subscriptionStartDate: toIso(profile.subscriptionStartDate),
      subscriptionEndDate: toIso(profile.subscriptionEndDate),
      subscriptionNextDueDate: toIso(profile.subscriptionNextDueDate),
      trialEndDate: toIso(profile.trialEndDate),
    },
    subscription: subscription
      ? {
          id: subscription.id,
          adhesionId: subscription.adhesionId,
          productId: subscription.productId,
          asaasSubscriptionId: subscription.asaasSubscriptionId,
          asaasInstallmentId: subscription.asaasInstallmentId,
          subscriptionStatus: subscription.subscriptionStatus,
          subscriptionPlan: subscription.subscriptionPlan,
          subscriptionCycle: subscription.subscriptionCycle,
          subscriptionStartDate: toIso(subscription.subscriptionStartDate),
          subscriptionEndDate: toIso(subscription.subscriptionEndDate),
          subscriptionNextDueDate: toIso(subscription.subscriptionNextDueDate),
          trialEndDate: toIso(subscription.trialEndDate),
          hasPermanentSubscription: subscription.hasPermanentSubscription,
        }
      : null,
    product: subscription?.product ?? null,
    adhesion: subscription?.adhesion ?? null,
    capacity: subscription?.capacity ?? null,
    userType: source.userType
      ? {
          slug: source.userType.slug,
          name: source.userType.name,
          accessStartsAt: toIso(source.userType.accessStartsAt),
          accessExpiresAt: toIso(source.userType.accessExpiresAt),
        }
      : null,
    entitlements: source.entitlements,
  };
}
