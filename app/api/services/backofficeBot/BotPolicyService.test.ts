import { describe, expect, it } from "bun:test";
import { UserFunction, UserRole } from "@prisma/client";
import { botPolicyService } from "./BotPolicyService";
import type { BotPolicyAccessLike } from "./botPolicy/role-access";

function buildAccess(
  overrides: Partial<BotPolicyAccessLike> & {
    role: UserRole;
    functions?: UserFunction[];
    profileId?: string;
    isMaster?: boolean;
  }
): BotPolicyAccessLike {
  return {
    isMaster: overrides.isMaster ?? false,
    canTransferAccountLeads: overrides.canTransferAccountLeads ?? false,
    profileId: overrides.profileId ?? "profile-1",
    teamMember: {
      role: overrides.role,
      functions: overrides.functions ?? [],
    },
  };
}

describe("BotPolicyService role gates", () => {
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
});
