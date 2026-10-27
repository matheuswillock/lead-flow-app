import { beforeEach, describe, expect, it, mock } from "bun:test";

type Args = Record<string, unknown>;

const findUniqueMock = mock(async (_args: Args) => null as Record<string, unknown> | null);
const upsertMock = mock(async (_args: Args) => ({ id: "activation-1" }));
const updateManyMock = mock(async (_args: Args) => ({ count: 1 }));
const updateMock = mock(async (_args: Args) => ({}));

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    teamApiResourceActivation: {
      findUnique: findUniqueMock,
      upsert: upsertMock,
      updateMany: updateManyMock,
      update: updateMock,
    },
  },
}));

const { TeamApiResourceActivationRepository } = await import("./TeamApiResourceActivationRepository");

describe("TeamApiResourceActivationRepository", () => {
  beforeEach(() => {
    findUniqueMock.mockReset();
    findUniqueMock.mockResolvedValue(null);
    upsertMock.mockClear();
    updateManyMock.mockReset();
    updateManyMock.mockResolvedValue({ count: 1 });
    updateMock.mockClear();
  });

  it("nenhuma consulta devolve o hash do token (select sem tokenHash)", async () => {
    const repo = new TeamApiResourceActivationRepository();
    await repo.findByTokenHash("hash");
    await repo.findByTeamAndSlug("team-1", "availability");
    await repo.upsertActivation({ teamId: "team-1", resourceSlug: "availability", tokenHash: "h", tokenPreview: "p", profileId: "pr" });

    for (const call of [findUniqueMock.mock.calls[0], findUniqueMock.mock.calls[1], upsertMock.mock.calls[0]]) {
      const select = (call?.[0] as { select: Record<string, boolean> }).select;
      expect(select).not.toHaveProperty("tokenHash");
      expect(select.tokenPreview).toBe(true);
    }
  });

  it("autentica pelo hash e identifica o time pela linha (T-14.6: o time vem do token)", async () => {
    await new TeamApiResourceActivationRepository().findByTokenHash("hash-abc");
    expect(findUniqueMock.mock.calls[0]?.[0]).toMatchObject({ where: { tokenHash: "hash-abc" } });
  });

  it("ativar de novo rotaciona o token, reativa o recurso e zera o último uso", async () => {
    await new TeamApiResourceActivationRepository().upsertActivation({
      teamId: "team-1",
      resourceSlug: "availability",
      tokenHash: "novo-hash",
      tokenPreview: "cs_avail_…abcd",
      profileId: "profile-1",
    });
    const call = upsertMock.mock.calls[0]?.[0] as { create: Args; update: Args; where: Args };
    expect(call.where).toEqual({ teamId_resourceSlug: { teamId: "team-1", resourceSlug: "availability" } });
    expect(call.create).toMatchObject({ status: "active", tokenHash: "novo-hash", activatedByProfileId: "profile-1" });
    expect(call.update).toMatchObject({ status: "active", tokenHash: "novo-hash", lastUsedAt: null });
  });

  it("desativar só muda o status: o token continua guardado para reativar (T-14.2)", async () => {
    findUniqueMock.mockResolvedValueOnce({ id: "activation-1", status: "inactive" });
    const row = await new TeamApiResourceActivationRepository().setStatus({
      teamId: "team-1",
      resourceSlug: "availability",
      status: "inactive",
      profileId: "profile-1",
    });
    expect(updateManyMock.mock.calls[0]?.[0]).toMatchObject({
      where: { teamId: "team-1", resourceSlug: "availability" },
      data: { status: "inactive", updatedByProfileId: "profile-1" },
    });
    expect((updateManyMock.mock.calls[0]?.[0] as { data: Args }).data).not.toHaveProperty("tokenHash");
    expect(row).toMatchObject({ status: "inactive" });
  });

  it("setStatus devolve null quando o recurso nunca foi ativado no time", async () => {
    updateManyMock.mockResolvedValueOnce({ count: 0 });
    const row = await new TeamApiResourceActivationRepository().setStatus({
      teamId: "team-1",
      resourceSlug: "availability",
      status: "inactive",
      profileId: "profile-1",
    });
    expect(row).toBeNull();
  });
});
