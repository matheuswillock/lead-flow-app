import { describe, expect, it, mock } from "bun:test";

mock.module("server-only", () => ({}));

const { canManageScheduleSettings } = await import("./route");

describe("team schedule settings authorization", () => {
  it("permite master e manager", () => {
    expect(canManageScheduleSettings({ isMaster: true, teamMember: { role: "backoffice" } })).toBe(true);
    expect(canManageScheduleSettings({ isMaster: false, teamMember: { role: "manager" } })).toBe(true);
  });

  it("bloqueia SDR, closer, backoffice e demais membros", () => {
    for (const role of ["operator", "closer", "backoffice", "sdr", "member"]) {
      expect(canManageScheduleSettings({ isMaster: false, teamMember: { role } })).toBe(false);
    }
  });
});
