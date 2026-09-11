import { describe, expect, it } from "bun:test";
import {
  SUBSCRIPTION_STATE_SNAPSHOT_SCHEMA_VERSION,
  assembleSubscriptionStateSnapshot,
  type SubscriptionStateSnapshotSource,
} from "./subscription-state-snapshot";

const source: SubscriptionStateSnapshotSource = {
  profile: {
    id: "profile-1",
    email: "master@example.com",
    supabaseId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    fullName: "Master Teste",
    isMaster: true,
    hasPermanentSubscription: false,
    hasUnlimitedUsers: false,
    asaasCustomerId: "cus_123",
    asaasSubscriptionId: "sub_123",
    subscriptionId: "sub_123",
    subscriptionStatus: "active",
    subscriptionPlan: "manager_base",
    subscriptionCycle: "MONTHLY",
    subscriptionStartDate: new Date("2026-01-01T00:00:00.000Z"),
    subscriptionEndDate: new Date("2026-02-01T00:00:00.000Z"),
    subscriptionNextDueDate: new Date("2026-02-01T00:00:00.000Z"),
    trialEndDate: null,
    operatorCount: 2,
  },
  subscription: {
    id: "sub-row-1",
    adhesionId: "adhesion-1",
    productId: "product-1",
    asaasSubscriptionId: "sub_123",
    asaasInstallmentId: null,
    subscriptionStatus: "active",
    subscriptionPlan: "manager_base",
    subscriptionCycle: "MONTHLY",
    subscriptionStartDate: new Date("2026-01-01T00:00:00.000Z"),
    subscriptionEndDate: new Date("2026-02-01T00:00:00.000Z"),
    subscriptionNextDueDate: new Date("2026-02-01T00:00:00.000Z"),
    trialEndDate: null,
    hasPermanentSubscription: false,
    product: {
      id: "product-1",
      name: "CRM 1 mês",
      type: "PLAN",
      isActive: true,
      featureSlugs: ["crm"],
    },
    adhesion: {
      id: "adhesion-1",
      status: "paid",
      cycle: "MONTHLY",
      totalAmount: "120.00",
      monthlyTotalAmount: "120.00",
      productId: "product-1",
      asaasCustomerId: "cus_123",
      asaasPaymentId: "pay_123",
      asaasInstallmentId: null,
      negotiatedTotalAmount: null,
      billingType: "PIX",
    },
    capacity: {
      includedExtraTeams: 0,
      includedExtraUsers: 2,
      manualAdjustmentExtraTeams: 0,
      manualAdjustmentExtraUsers: 0,
    },
  },
  userType: {
    slug: "comum",
    name: "Comum",
    accessStartsAt: null,
    accessExpiresAt: null,
  },
  entitlements: [
    {
      slug: "crm",
      name: "CRM",
      grantType: "PAID",
      accessLevel: "FULL",
    },
  ],
};

describe("assembleSubscriptionStateSnapshot", () => {
  it("congela datas em ISO e preserva produto, adesão e entitlements", () => {
    const payload = assembleSubscriptionStateSnapshot(source);

    expect(payload.schemaVersion).toBe(SUBSCRIPTION_STATE_SNAPSHOT_SCHEMA_VERSION);
    expect(payload.profile.email).toBe("master@example.com");
    expect(payload.profile.subscriptionEndDate).toBe("2026-02-01T00:00:00.000Z");
    expect(payload.product?.name).toBe("CRM 1 mês");
    expect(payload.adhesion?.totalAmount).toBe("120.00");
    expect(payload.capacity?.includedExtraUsers).toBe(2);
    expect(payload.userType?.slug).toBe("comum");
    expect(payload.entitlements).toEqual([
      { slug: "crm", name: "CRM", grantType: "PAID", accessLevel: "FULL" },
    ]);
  });

  it("aceita master sem ProfileSubscription", () => {
    const payload = assembleSubscriptionStateSnapshot({
      ...source,
      subscription: null,
    });

    expect(payload.subscription).toBeNull();
    expect(payload.product).toBeNull();
    expect(payload.adhesion).toBeNull();
    expect(payload.capacity).toBeNull();
  });
});
