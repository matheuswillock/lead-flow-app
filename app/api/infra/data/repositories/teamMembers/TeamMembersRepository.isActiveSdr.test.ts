import { beforeEach, describe, expect, it, mock } from "bun:test";

const findFirstMock = mock(async (_args: Record<string, unknown>) => null as { id: string } | null);
const findManyMock = mock(async (_args: Record<string, unknown>) => [] as Array<Record<string, unknown>>);

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: { teamMember: { findFirst: findFirstMock, findMany: findManyMock } },
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

describe("TeamMembersRepository.findActiveClosers (API de horários)", () => {
  it("lista só closers do time com perfil e time ativos, em ordem alfabética", async () => {
    findManyMock.mockResolvedValueOnce([
      { profileId: "c2", profile: { fullName: "Zeca" } },
      { profileId: "c1", profile: { fullName: "Ana Lima" } },
    ]);
    const closers = await new TeamMembersRepository().findActiveClosers("team-1");
    expect(closers).toEqual([
      { profileId: "c1", fullName: "Ana Lima" },
      { profileId: "c2", fullName: "Zeca" },
    ]);
    expect(findManyMock.mock.calls[0]?.[0]).toMatchObject({
      where: { teamId: "team-1", functions: { has: "CLOSER" }, team: { deletedAt: null }, profile: { deletedAt: null } },
    });
  });
});
