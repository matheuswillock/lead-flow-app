import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test";

mock.module("server-only", () => ({}));

const logAuditMock = mock(async (_entry: Record<string, unknown>) => undefined);
mock.module("@/app/api/useCases/audit/AuditLogWriter", () => ({
  auditLogWriter: { logAudit: logAuditMock },
}));

const { TeamManagementUseCase, TEAM_MANAGEMENT_ERRORS } = await import("./TeamManagementUseCase");
const { TeamUpdateError } = await import("@/app/api/infra/data/repositories/team/ITeamRepository");

type TeamRepoStub = {
  updateTeamWithTransferRoutes: ReturnType<typeof mock>;
  findAuditSnapshot: ReturnType<typeof mock>;
  deleteTeam: ReturnType<typeof mock>;
};

type ProfileRepoStub = {
  findAuthContactBySupabaseId: ReturnType<typeof mock>;
  findIdentityById: ReturnType<typeof mock>;
};

let teams: TeamRepoStub;
let profiles: ProfileRepoStub;

function buildUseCase() {
  return new TeamManagementUseCase(
    teams as never,
    profiles as never
  );
}

const UPDATE_INPUT = {
  teamId: "team-1",
  masterId: "master-1",
  actorProfileId: "profile-1",
  name: "Novo nome",
};

beforeEach(() => {
  logAuditMock.mockClear();
  teams = {
    updateTeamWithTransferRoutes: mock(async () => ({
      before: { id: "team-1", name: "Antigo", isDefault: false },
      after: { id: "team-1", name: "Novo nome", isDefault: false },
    })),
    findAuditSnapshot: mock(async () => ({
      id: "team-1",
      name: "Time",
      masterId: "master-1",
      isDefault: false,
    })),
    deleteTeam: mock(async () => undefined),
  };
  profiles = {
    findAuthContactBySupabaseId: mock(async () => ({ id: "profile-1", email: "a@x.com" })),
    findIdentityById: mock(async () => ({ id: "master-1", supabaseId: "sup-master" })),
  };
});

describe("updateTeam", () => {
  it("devolve o time atualizado e registra auditoria", async () => {
    const output = await buildUseCase().updateTeam(UPDATE_INPUT);

    expect(output.isValid).toBe(true);
    expect(output.result).toMatchObject({ name: "Novo nome" });
    expect(logAuditMock).toHaveBeenCalledTimes(1);
  });

  it("registra o antes e o depois na auditoria", async () => {
    await buildUseCase().updateTeam(UPDATE_INPUT);

    expect(logAuditMock.mock.calls[0]?.[0]).toMatchObject({
      entityType: "TEAM",
      action: "UPDATE",
      before: { name: "Antigo" },
      after: { name: "Novo nome" },
    });
  });

  it("traduz time inexistente em mensagem propria, sem auditar", async () => {
    teams.updateTeamWithTransferRoutes = mock(async () => {
      throw new TeamUpdateError("TEAM_NOT_FOUND");
    });

    const output = await buildUseCase().updateTeam(UPDATE_INPUT);

    expect(output.isValid).toBe(false);
    expect(output.errorMessages).toEqual([TEAM_MANAGEMENT_ERRORS.NOT_FOUND]);
    expect(logAuditMock).not.toHaveBeenCalled();
  });

  it("recusa desmarcar o unico time padrao da conta", async () => {
    teams.updateTeamWithTransferRoutes = mock(async () => {
      throw new TeamUpdateError("CANNOT_UNSET_ONLY_DEFAULT");
    });

    const output = await buildUseCase().updateTeam({ ...UPDATE_INPUT, isDefault: false });

    expect(output.isValid).toBe(false);
    expect(output.errorMessages).toEqual([TEAM_MANAGEMENT_ERRORS.ONLY_DEFAULT]);
  });

  it("nao vaza erro inesperado como mensagem de dominio", async () => {
    const consoleError = spyOn(console, "error").mockImplementation(() => undefined);
    teams.updateTeamWithTransferRoutes = mock(async () => {
      throw new Error("connection reset");
    });

    const output = await buildUseCase().updateTeam(UPDATE_INPUT);

    expect(output.errorMessages).toEqual([TEAM_MANAGEMENT_ERRORS.UPDATE_FAILED]);
    consoleError.mockRestore();
  });
});

describe("findDeletionActors", () => {
  it("resolve solicitante e responsavel pela cobranca", async () => {
    const output = await buildUseCase().findDeletionActors("sup-1", "master-1");

    expect(output.isValid).toBe(true);
    expect(output.result).toEqual({
      requesterId: "profile-1",
      requesterEmail: "a@x.com",
      billingOwnerId: "master-1",
    });
  });

  it("falha quando o solicitante nao existe", async () => {
    profiles.findAuthContactBySupabaseId = mock(async () => null);

    const output = await buildUseCase().findDeletionActors("sup-1", "master-1");

    expect(output.isValid).toBe(false);
    expect(output.errorMessages).toEqual([TEAM_MANAGEMENT_ERRORS.PROFILE_NOT_FOUND]);
  });

  it("falha quando o responsavel pela cobranca nao existe", async () => {
    profiles.findIdentityById = mock(async () => null);

    const output = await buildUseCase().findDeletionActors("sup-1", "master-1");

    expect(output.isValid).toBe(false);
  });
});

describe("deleteTeam", () => {
  it("tira o snapshot antes de remover", async () => {
    const chamadas: string[] = [];
    teams.findAuditSnapshot = mock(async () => {
      chamadas.push("snapshot");
      return { id: "team-1", name: "Time", masterId: "master-1", isDefault: false };
    });
    teams.deleteTeam = mock(async () => {
      chamadas.push("delete");
    });

    await buildUseCase().deleteTeam("team-1", "profile-1");

    // O snapshot precisa vir antes: depois do delete nao ha o que auditar.
    expect(chamadas).toEqual(["snapshot", "delete"]);
  });

  it("audita a remocao com o estado anterior", async () => {
    const output = await buildUseCase().deleteTeam("team-1", "profile-1");

    expect(output.isValid).toBe(true);
    expect(logAuditMock.mock.calls[0]?.[0]).toMatchObject({
      action: "DELETE",
      before: { name: "Time" },
      after: null,
    });
  });
});
