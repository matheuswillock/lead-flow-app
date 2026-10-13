import { describe, expect, it } from "bun:test";
import { BILLING_PRICES } from "@/app/api/shared/billing/billingConfig";
import { buildBillingSummary } from "@/app/api/shared/billing/billingSummary";
import {
  isActiveMemberProAssignment,
  resolveMemberProAccessWindow,
  resolveHasUnlimitedUsers,
  resolveMemberProBypass,
} from "@/app/api/shared/billing/memberProBillingRules";

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

describe("isActiveMemberProAssignment", () => {
  const now = new Date("2026-07-09T12:00:00.000Z");

  it("retorna true para Member PRO dentro do prazo", () => {
    expect(
      isActiveMemberProAssignment(
        {
          slug: "member_pro",
          accessExpiresAt: new Date("2026-08-01T00:00:00.000Z"),
        },
        now
      )
    ).toBe(true);
  });

  it("retorna false para Member PRO sem data de expiração", () => {
    expect(
      isActiveMemberProAssignment(
        {
          slug: "member_pro",
          accessExpiresAt: null,
        },
        now
      )
    ).toBe(false);
  });

  it("retorna false para Member PRO expirado", () => {
    expect(
      isActiveMemberProAssignment(
        {
          slug: "member_pro",
          accessExpiresAt: new Date("2026-07-01T00:00:00.000Z"),
        },
        now
      )
    ).toBe(false);
  });

  it("retorna false para Member PRO que ainda não começou", () => {
    expect(
      isActiveMemberProAssignment(
        {
          slug: "member_pro",
          accessStartsAt: new Date("2026-07-10T00:00:00.000Z"),
          accessExpiresAt: new Date("2026-08-01T00:00:00.000Z"),
        },
        now
      )
    ).toBe(false);
  });

  it("retorna false para usuário comum", () => {
    expect(
      isActiveMemberProAssignment(
        {
          slug: "common",
          accessExpiresAt: null,
        },
        now
      )
    ).toBe(false);
  });
});

describe("resolveMemberProAccessWindow", () => {
  const start = new Date("2026-08-01T12:00:00.000Z")

  it("cria uma janela de exatamente 100 dias", () => {
    const window = resolveMemberProAccessWindow({ start })

    expect(window.accessStartsAt).toEqual(start)
    expect(window.accessExpiresAt).toEqual(new Date("2026-11-09T12:00:00.000Z"))
  })

  it("estende uma janela de 90 dias sem reduzir uma janela maior", () => {
    const extended = resolveMemberProAccessWindow({
      start,
      currentExpiresAt: new Date("2026-10-30T12:00:00.000Z"),
    })
    const preserved = resolveMemberProAccessWindow({
      start,
      currentExpiresAt: new Date("2027-02-01T12:00:00.000Z"),
    })

    expect(extended.accessExpiresAt).toEqual(new Date("2026-11-09T12:00:00.000Z"))
    expect(preserved.accessExpiresAt).toEqual(new Date("2027-02-01T12:00:00.000Z"))
  })
})

describe("resolveHasUnlimitedUsers", () => {
  it("retorna true quando a flag persistida está ativa", () => {
    expect(
      resolveHasUnlimitedUsers({
        hasUnlimitedUsersFlag: true,
        hasPermanentSubscription: false,
      })
    ).toBe(true);
  });

  it("retorna true somente para o ciclo anual", () => {
    expect(resolveHasUnlimitedUsers({ hasUnlimitedUsersFlag: false, billingCycle: "annual" })).toBe(true);
  });

  it("retorna false sem flag e sem vitalício", () => {
    expect(
      resolveHasUnlimitedUsers({
        hasUnlimitedUsersFlag: false,
        hasPermanentSubscription: false,
      })
    ).toBe(false);
  });

  it("ignora flag stale de Member PRO expirado", () => {
    expect(
      resolveHasUnlimitedUsers({
        hasUnlimitedUsersFlag: true,
        memberProSlug: "member_pro",
        memberProActive: false,
      })
    ).toBe(false);
  });
});

describe("resolveMemberProBypass com hasUnlimitedUsers", () => {
  it("retorna true quando a flag de usuários ilimitados está ativa", () => {
    expect(
      resolveMemberProBypass({
        slug: "common",
        isActive: false,
        accessExpiresAt: null,
        hasUnlimitedUsers: true,
      })
    ).toBe(true);
  });

  it("não mantém bypass de uma flag stale após expiração do Member PRO", () => {
    expect(
      resolveMemberProBypass({
        slug: "member_pro",
        isActive: false,
        accessExpiresAt: new Date(Date.now() - 1_000),
        hasUnlimitedUsers: true,
      })
    ).toBe(false)
  })
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

  it("não cobra usuários extras com flag de ilimitado", () => {
    const summary = buildBillingSummary("master-1", {
      hasPermanentSubscription: false,
      hasUnlimitedUsers: true,
      teamCount: 1,
      distinctUserCount: 5,
      totalUsersIncludingMaster: 6,
      includedExtraTeams: 0,
      includedExtraUsers: 0,
      manualAdjustmentExtraTeams: 0,
      manualAdjustmentExtraUsers: 0,
    });

    expect(summary.hasUnlimitedUsers).toBe(true);
    expect(summary.availableUserSlots).toBe(Number.MAX_SAFE_INTEGER);
    expect(summary.billableUsers).toBe(0);
    expect(summary.totalPrice).toBe(BILLING_PRICES.base);
  });
});
