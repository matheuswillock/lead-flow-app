import { beforeEach, describe, expect, it, mock } from "bun:test";

const findFirstMock = mock(async (_args: Record<string, unknown>) => null as { id: string } | null);

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: { teamMember: { findFirst: findFirstMock } },
}));

const { TeamMembersRepository } = await import("./TeamMembersRepository");

describe("TeamMembersRepository.isActiveSdr (assigned_to do webhook v2)", () => {
  beforeEach(() => findFirstMock.mockReset());

  it("é verdadeiro só para membro do time com a função SDR e perfil não deletado", async () => {
    findFirstMock.mockResolvedValueOnce({ id: "member-1" });
    expect(await new TeamMembersRepository().isActiveSdr("team-1", "profile-1")).toBe(true);
    expect(findFirstMock.mock.calls[0]?.[0]).toMatchObject({
      where: { teamId: "team-1", profileId: "profile-1", functions: { has: "SDR" }, profile: { deletedAt: null } },
    });
  });

  it("é falso para quem não é SDR do time (closer, outro time, perfil removido)", async () => {
    findFirstMock.mockResolvedValueOnce(null);
    expect(await new TeamMembersRepository().isActiveSdr("team-1", "profile-2")).toBe(false);
  });
});
