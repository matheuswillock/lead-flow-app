import { describe, expect, it } from "bun:test";
import { buildLeadScheduleTeamScopeWhere } from "./leadScheduleTeamScopeWhere";

const OWNER_PROFILE_ID = "11111111-1111-4111-8111-111111111111";

describe("buildLeadScheduleTeamScopeWhere", () => {
  it("mistura time team-wide e time restrito ao dono na mesma consulta", () => {
    const where = buildLeadScheduleTeamScopeWhere({
      fullVisibilityTeamIds: ["team-a"],
      ownOnlyTeamIds: ["team-b"],
      ownerProfileId: OWNER_PROFILE_ID,
    });

    expect(where).toEqual({
      OR: [
        { lead: { teamId: { in: ["team-a"] } } },
        {
          lead: {
            teamId: { in: ["team-b"] },
            OR: [{ assignedTo: OWNER_PROFILE_ID }, { createdBy: OWNER_PROFILE_ID }],
          },
        },
      ],
    });
  });

  it("não restringe ao dono o time onde o perfil é manager-like", () => {
    const where = buildLeadScheduleTeamScopeWhere({
      fullVisibilityTeamIds: ["team-a", "team-c"],
      ownOnlyTeamIds: [],
      ownerProfileId: OWNER_PROFILE_ID,
    });

    expect(where).toEqual({ OR: [{ lead: { teamId: { in: ["team-a", "team-c"] } } }] });
    expect(JSON.stringify(where)).not.toContain(OWNER_PROFILE_ID);
  });

  it("não devolve ramo algum para escopo vazio", () => {
    const where = buildLeadScheduleTeamScopeWhere({
      fullVisibilityTeamIds: [],
      ownOnlyTeamIds: [],
      ownerProfileId: OWNER_PROFILE_ID,
    });

    expect(where).toEqual({ OR: [] });
  });
});
