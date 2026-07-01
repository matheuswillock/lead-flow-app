import { describe, expect, it } from "bun:test";
import { BILLING_PRICES } from "@/app/api/shared/billing/billingConfig";
import { buildBillingSummary } from "@/app/api/shared/billing/billingSummary";
import { resolveMemberProBypass } from "@/app/api/shared/billing/memberProBillingRules";

describe("resolveMemberProBypass", () => {
  it("retorna true para Member PRO ativo sem forceCharge", () => {
    expect(
      resolveMemberProBypass({
        slug: "member_pro",
        isActive: true,
        accessExpiresAt: new Date(Date.now() + 86_400_000),
      })
    ).toBe(true);
  });

  it("retorna false quando forceCharge é true", () => {
    expect(
      resolveMemberProBypass(
        {
          slug: "member_pro",
          isActive: true,
          accessExpiresAt: new Date(Date.now() + 86_400_000),
        },
        { forceCharge: true }
      )
    ).toBe(false);
  });

  it("retorna false para Member PRO expirado", () => {
    expect(
      resolveMemberProBypass({
        slug: "member_pro",
        isActive: false,
        accessExpiresAt: new Date(Date.now() - 86_400_000),
      })
    ).toBe(false);
  });

  it("retorna false para usuário comum", () => {
    expect(
      resolveMemberProBypass({
        slug: "common",
        isActive: false,
        accessExpiresAt: null,
      })
    ).toBe(false);
  });
});

describe("Member PRO billing totals", () => {
  it("calcula total com 1 usuário extra", () => {
    const summary = buildBillingSummary("master-1", {
      hasPermanentSubscription: false,
      hasUnlimitedUsers: false,
      teamCount: 1,
      distinctUserCount: 1,
      totalUsersIncludingMaster: 2,
      includedExtraTeams: 0,
      includedExtraUsers: 0,
      manualAdjustmentExtraTeams: 0,
      manualAdjustmentExtraUsers: 0,
    });

    expect(summary.totalPrice).toBe(
      Number((BILLING_PRICES.base + BILLING_PRICES.extraUser).toFixed(2))
    );
  });

  it("volta ao base após remover usuário extra", () => {
    const summary = buildBillingSummary("master-1", {
      hasPermanentSubscription: false,
      hasUnlimitedUsers: false,
      teamCount: 1,
      distinctUserCount: 0,
      totalUsersIncludingMaster: 1,
      includedExtraTeams: 0,
      includedExtraUsers: 0,
      manualAdjustmentExtraTeams: 0,
      manualAdjustmentExtraUsers: 0,
    });

    expect(summary.totalPrice).toBe(BILLING_PRICES.base);
  });
});
