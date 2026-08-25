import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import {
  AuthorizeLeadAccessUseCase,
  LEAD_NOT_FOUND_MESSAGE,
} from "./AuthorizeLeadAccessUseCase";
import type { ILeadRepository } from "@/app/api/infra/data/repositories/lead/ILeadRepository";
import type { ILeadTransferRepository } from "@/app/api/infra/data/repositories/leadTransfer/ILeadTransferRepository";

const REQUESTER_TEAM = "team-requester";
const OTHER_TEAM = "team-other";

function leadSnapshot(overrides: Record<string, unknown> = {}) {
  return {
    id: "lead-1",
    teamId: REQUESTER_TEAM,
    status: "scheduled",
    closerId: null,
    assignedTo: null,
    isTransfer: false,
    meetingDate: null,
    ...overrides,
  };
}

const findAuthorizationSnapshotById = mock(async (_id: string) => leadSnapshot() as never);
const existsTransferFromTeam = mock(
  async (_params: { leadId: string; fromTeamId: string }) => false
);

function buildUseCase() {
  return new AuthorizeLeadAccessUseCase(
    { findAuthorizationSnapshotById } as unknown as ILeadRepository,
    { existsTransferFromTeam } as unknown as ILeadTransferRepository
  );
}

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    leadId: "lead-1",
    teamId: REQUESTER_TEAM,
    profileId: "profile-1",
    allowTransferredFromTeam: false,
    ...overrides,
  } as Parameters<AuthorizeLeadAccessUseCase["execute"]>[0];
}

beforeEach(() => {
  findAuthorizationSnapshotById.mockReset();
  existsTransferFromTeam.mockReset();
  findAuthorizationSnapshotById.mockImplementation(async () => leadSnapshot() as never);
  existsTransferFromTeam.mockImplementation(async () => false);
});

describe("lead do proprio time", () => {
  it("autoriza e devolve o snapshot", async () => {
    const output = await buildUseCase().execute(baseInput());

    expect(output.isValid).toBe(true);
    expect(output.result).toMatchObject({ id: "lead-1", teamId: REQUESTER_TEAM });
  });

  it("nao consulta transferencias quando o time bate", async () => {
    await buildUseCase().execute(baseInput());

    expect(existsTransferFromTeam).not.toHaveBeenCalled();
  });
});

describe("lead inexistente", () => {
  it("nega com a mensagem generica", async () => {
    findAuthorizationSnapshotById.mockImplementation(async () => null as never);

    const output = await buildUseCase().execute(baseInput());

    expect(output.isValid).toBe(false);
    expect(output.errorMessages).toEqual([LEAD_NOT_FOUND_MESSAGE]);
    expect(output.result).toBeNull();
  });
});

describe("lead de outro time", () => {
  beforeEach(() => {
    findAuthorizationSnapshotById.mockImplementation(
      async () => leadSnapshot({ teamId: OTHER_TEAM }) as never
    );
  });

  it("nega quando o solicitante nao pode ver transferidos", async () => {
    const warn = spyOn(console, "warn").mockImplementation(() => undefined);

    const output = await buildUseCase().execute(
      baseInput({ allowTransferredFromTeam: false })
    );

    expect(output.isValid).toBe(false);
    expect(output.errorMessages).toEqual([LEAD_NOT_FOUND_MESSAGE]);
    // sem permissao de transferido, nem consulta a tabela
    expect(existsTransferFromTeam).not.toHaveBeenCalled();

    warn.mockRestore();
  });

  it("autoriza manager do time de origem quando houve transferencia", async () => {
    existsTransferFromTeam.mockImplementation(async () => true);

    const output = await buildUseCase().execute(
      baseInput({ allowTransferredFromTeam: true })
    );

    expect(output.isValid).toBe(true);
    expect(existsTransferFromTeam).toHaveBeenCalledWith({
      leadId: "lead-1",
      fromTeamId: REQUESTER_TEAM,
    });
  });

  it("nega manager quando nao houve transferencia a partir do time dele", async () => {
    const warn = spyOn(console, "warn").mockImplementation(() => undefined);
    existsTransferFromTeam.mockImplementation(async () => false);

    const output = await buildUseCase().execute(
      baseInput({ allowTransferredFromTeam: true })
    );

    expect(output.isValid).toBe(false);
    expect(output.errorMessages).toEqual([LEAD_NOT_FOUND_MESSAGE]);

    warn.mockRestore();
  });

  it("usa a mesma mensagem de lead inexistente para nao vazar existencia", async () => {
    const warn = spyOn(console, "warn").mockImplementation(() => undefined);

    const denied = await buildUseCase().execute(baseInput());
    findAuthorizationSnapshotById.mockImplementation(async () => null as never);
    const missing = await buildUseCase().execute(baseInput());

    expect(denied.errorMessages).toEqual(missing.errorMessages);

    warn.mockRestore();
  });
});
