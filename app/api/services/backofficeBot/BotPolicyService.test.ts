import { describe, expect, it } from "bun:test";
import { UserFunction, UserRole } from "@prisma/client";
import { botPolicyService } from "./BotPolicyService";
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess";

function buildAccess(overrides: Partial<TeamAccess> & { role: UserRole; functions?: UserFunction[] }): TeamAccess {
  return {
    supabaseId: "supabase-1",
    teamId: "team-1",
    profileId: "profile-1",
    profileEmail: "user@test.com",
    profileName: "User",
    isMaster: false,
    managerId: "manager-1",
    canCreateAccountUsers: false,
    canManageAccountTeams: false,
    canTransferAccountLeads: false,
    canViewAllTeams: false,
    userTimezone: "America/Sao_Paulo",
    teamMember: {
      role: overrides.role,
      functions: overrides.functions ?? [],
    },
    ...overrides,
  };
}

describe("BotPolicyService", () => {
  it("MASTER pode adicionar nota", () => {
    const access = buildAccess({ role: "manager", isMaster: true });
    expect(botPolicyService.canAddNote({ access })).toBe(true);
  });

  it("OPERATOR sem hasLeadActivityAccess não pode adicionar nota", () => {
    const access = buildAccess({ role: "operator", functions: [] });
    expect(botPolicyService.canAddNote({ access })).toBe(false);
  });

  it("OPERATOR com hasLeadActivityAccess pode adicionar nota", () => {
    const access = buildAccess({
      role: "operator",
      functions: ["SDR"],
    });
    expect(botPolicyService.canAddNote({ access })).toBe(true);
  });

  it("OPERATOR só agenda reunião se for assignedTo ou closer", () => {
    const access = buildAccess({ role: "operator", functions: ["SDR"], profileId: "op-1" });
    expect(
      botPolicyService.canScheduleMeeting({
        access,
        lead: { assignedToId: "other", closerId: null },
      })
    ).toBe(false);
    expect(
      botPolicyService.canScheduleMeeting({
        access,
        lead: { assignedToId: "op-1", closerId: null },
      })
    ).toBe(true);
  });

  it("MANAGER pode ver resumo do time", () => {
    const access = buildAccess({ role: "manager" });
    expect(botPolicyService.canViewTeamDigest({ access })).toBe(true);
  });

  it("OPERATOR não pode ver resumo do time", () => {
    const access = buildAccess({ role: "operator", functions: ["SDR"] });
    expect(botPolicyService.canViewTeamDigest({ access })).toBe(false);
  });
});
