import { describe, expect, it } from "bun:test";
import { buildTaskTeamScopeWhere } from "./taskTeamScopeWhere";

const OWNER_PROFILE_ID = "11111111-1111-4111-8111-111111111111";

describe("buildTaskTeamScopeWhere", () => {
  it("gera um ramo team-wide e um ramo restrito ao dono, num único IN por ramo", () => {
    const where = buildTaskTeamScopeWhere({
      fullVisibilityTeamIds: ["team-a", "team-c"],
      ownOnlyTeamIds: ["team-b"],
      ownerProfileId: OWNER_PROFILE_ID,
    });

    expect(where).toEqual({
      OR: [
        { lead: { teamId: { in: ["team-a", "team-c"] } } },
        {
          lead: { teamId: { in: ["team-b"] } },
          OR: [
            { createdBy: OWNER_PROFILE_ID },
            { assignees: { some: { profileId: OWNER_PROFILE_ID } } },
          ],
        },
      ],
    });
  });

  it("não restringe ao dono os times onde o perfil é manager-like", () => {
    const where = buildTaskTeamScopeWhere({
      fullVisibilityTeamIds: ["team-a"],
      ownOnlyTeamIds: [],
      ownerProfileId: OWNER_PROFILE_ID,
    });

    expect(where).toEqual({ OR: [{ lead: { teamId: { in: ["team-a"] } } }] });
    expect(JSON.stringify(where)).not.toContain(OWNER_PROFILE_ID);
  });

  it("restringe ao dono quando o perfil só tem times de papel menor", () => {
    const where = buildTaskTeamScopeWhere({
      fullVisibilityTeamIds: [],
      ownOnlyTeamIds: ["team-b"],
      ownerProfileId: OWNER_PROFILE_ID,
    });

    expect(where).toEqual({
      OR: [
        {
          lead: { teamId: { in: ["team-b"] } },
          OR: [
            { createdBy: OWNER_PROFILE_ID },
            { assignees: { some: { profileId: OWNER_PROFILE_ID } } },
          ],
        },
      ],
    });
  });

  it("não devolve ramo algum para escopo vazio — Prisma não pode casar tudo", () => {
    const where = buildTaskTeamScopeWhere({
      fullVisibilityTeamIds: [],
      ownOnlyTeamIds: [],
      ownerProfileId: OWNER_PROFILE_ID,
    });

    expect(where).toEqual({ OR: [] });
  });
});
