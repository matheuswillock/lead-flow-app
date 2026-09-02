import { describe, expect, it, mock, beforeEach } from "bun:test";
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess";
import { UserRole } from "@prisma/client";

const findByIdMock = mock(async () => null as Record<string, unknown> | null);
const getMergeRelationSnapshotMock = mock(async () => ({
  targetPortfolio: false,
  sourcePortfolio: false,
  targetProposalReview: false,
  sourceProposalReview: false,
  targetSchedule: false,
  sourceSchedule: false,
}));
const mergeLeadsInTransactionMock = mock(async () => undefined);
const findProfileByIdentityMock = mock(
  async (_teamId: string, _type: "lead_id", _value: string): Promise<{ profileId: string } | null> =>
    null
);
const mergeProfilesMock = mock(async () => undefined);
const reconcileLeadIdentityAfterMergeMock = mock(async () => undefined);

const { MergeLeadsUseCase } = await import("./MergeLeadsUseCase");

function makeAccess(teamId = "team-1"): TeamAccess {
  return {
    supabaseId: "supabase-1",
    teamId,
    profileId: "profile-1",
    profileEmail: "manager@test.com",
    profileName: "Manager",
    isMaster: false,
    managerId: "manager-1",
    canCreateAccountUsers: false,
    canManageAccountTeams: false,
    canTransferAccountLeads: false,
    canViewAllTeams: false,
    userTimezone: "America/Sao_Paulo",
    teamMember: { role: UserRole.manager, functions: [] },
  };
}

const baseLead = {
  id: "target-1",
  leadCode: "LF-TARGET",
  teamId: "team-1",
  isTransfer: false,
  email: null,
  phone: "5511999999999",
  cnpj: null,
  razaoSocial: null,
  age: null,
  currentHealthPlan: null,
  currentValue: null,
  referenceHospital: null,
  currentTreatment: null,
  notes: null,
  soldPlan: null,
  ticket: null,
  contractDueDate: null,
  referrerName: null,
  referrerPhone: null,
  meetingTitle: null,
  meetingNotes: null,
  meetingLink: null,
  meetingType: null,
};

function makeUseCase() {
  return new MergeLeadsUseCase(
    {
      findById: findByIdMock,
      getMergeRelationSnapshot: getMergeRelationSnapshotMock,
      mergeLeadsInTransaction: mergeLeadsInTransactionMock,
    } as never,
    {
      findProfileByIdentity: findProfileByIdentityMock,
      mergeProfiles: mergeProfilesMock,
      reconcileLeadIdentityAfterMerge: reconcileLeadIdentityAfterMergeMock,
    }
  );
}

describe("MergeLeadsUseCase", () => {
  beforeEach(() => {
    findByIdMock.mockReset();
    getMergeRelationSnapshotMock.mockReset();
    mergeLeadsInTransactionMock.mockReset();
    findProfileByIdentityMock.mockReset();
    mergeProfilesMock.mockReset();
    reconcileLeadIdentityAfterMergeMock.mockReset();
    getMergeRelationSnapshotMock.mockResolvedValue({
      targetPortfolio: false,
      sourcePortfolio: false,
      targetProposalReview: false,
      sourceProposalReview: false,
      targetSchedule: false,
      sourceSchedule: false,
    });
  });

  it("mescla leads com sucesso", async () => {
    findByIdMock
      .mockResolvedValueOnce({ ...baseLead, id: "target-1", leadCode: "LF-TARGET" })
      .mockResolvedValueOnce({
        ...baseLead,
        id: "source-1",
        leadCode: "LF-SOURCE",
        email: "origem@test.com",
      });

    const output = await makeUseCase().execute(makeAccess(), {
      targetLeadId: "target-1",
      sourceLeadId: "source-1",
    });

    expect(output.isValid).toBe(true);
    expect(mergeLeadsInTransactionMock).toHaveBeenCalled();
  });

  it("E3b: funde perfis Radar distintos após merge CRM", async () => {
    findByIdMock
      .mockResolvedValueOnce({ ...baseLead, id: "target-1", leadCode: "LF-TARGET" })
      .mockResolvedValueOnce({ ...baseLead, id: "source-1", leadCode: "LF-SOURCE" });

    findProfileByIdentityMock
      .mockResolvedValueOnce({ profileId: "radar-target" })
      .mockResolvedValueOnce({ profileId: "radar-source" });

    const output = await makeUseCase().execute(makeAccess(), {
      targetLeadId: "target-1",
      sourceLeadId: "source-1",
    });

    expect(output.isValid).toBe(true);
    expect(mergeLeadsInTransactionMock).toHaveBeenCalled();
    expect(findProfileByIdentityMock).toHaveBeenCalledTimes(2);
    expect(findProfileByIdentityMock).toHaveBeenCalledWith("team-1", "lead_id", "target-1");
    expect(findProfileByIdentityMock).toHaveBeenCalledWith("team-1", "lead_id", "source-1");
    expect(mergeProfilesMock).toHaveBeenCalledWith("team-1", "radar-source", "radar-target");
  });

  it("E3b: não funde Radar quando os leads já compartilham o mesmo perfil", async () => {
    findByIdMock
      .mockResolvedValueOnce({ ...baseLead, id: "target-1" })
      .mockResolvedValueOnce({ ...baseLead, id: "source-1", leadCode: "LF-SOURCE" });

    findProfileByIdentityMock
      .mockResolvedValueOnce({ profileId: "radar-shared" })
      .mockResolvedValueOnce({ profileId: "radar-shared" });

    const output = await makeUseCase().execute(makeAccess(), {
      targetLeadId: "target-1",
      sourceLeadId: "source-1",
    });

    expect(output.isValid).toBe(true);
    expect(mergeProfilesMock).not.toHaveBeenCalled();
  });

  it("E3b: falha no Radar após CRM não invalida a mesclagem", async () => {
    findByIdMock
      .mockResolvedValueOnce({ ...baseLead, id: "target-1" })
      .mockResolvedValueOnce({ ...baseLead, id: "source-1", leadCode: "LF-SOURCE" });

    findProfileByIdentityMock
      .mockResolvedValueOnce({ profileId: "radar-target" })
      .mockResolvedValueOnce({ profileId: "radar-source" });
    mergeProfilesMock.mockRejectedValueOnce(new Error("radar down"));

    const output = await makeUseCase().execute(makeAccess(), {
      targetLeadId: "target-1",
      sourceLeadId: "source-1",
    });

    expect(output.isValid).toBe(true);
    expect(mergeProfilesMock).toHaveBeenCalled();
  });

  it("E3c: reaponta a identidade lead_id do Radar após o merge do CRM", async () => {
    findByIdMock
      .mockResolvedValueOnce({ ...baseLead, id: "target-1" })
      .mockResolvedValueOnce({ ...baseLead, id: "source-1", leadCode: "LF-SOURCE" });

    const output = await makeUseCase().execute(makeAccess(), {
      targetLeadId: "target-1",
      sourceLeadId: "source-1",
    });

    expect(output.isValid).toBe(true);
    expect(reconcileLeadIdentityAfterMergeMock).toHaveBeenCalledWith(
      "team-1",
      "source-1",
      "target-1"
    );
  });

  it("E3c: falha ao reconciliar a identidade Radar não invalida a mesclagem", async () => {
    findByIdMock
      .mockResolvedValueOnce({ ...baseLead, id: "target-1" })
      .mockResolvedValueOnce({ ...baseLead, id: "source-1", leadCode: "LF-SOURCE" });
    reconcileLeadIdentityAfterMergeMock.mockRejectedValueOnce(new Error("radar down"));

    const output = await makeUseCase().execute(makeAccess(), {
      targetLeadId: "target-1",
      sourceLeadId: "source-1",
    });

    expect(output.isValid).toBe(true);
    expect(reconcileLeadIdentityAfterMergeMock).toHaveBeenCalled();
  });

  it("aborta quando ambos possuem carteira", async () => {
    findByIdMock
      .mockResolvedValueOnce({ ...baseLead, id: "target-1" })
      .mockResolvedValueOnce({ ...baseLead, id: "source-1", leadCode: "LF-SOURCE" });
    getMergeRelationSnapshotMock.mockResolvedValueOnce({
      targetPortfolio: true,
      sourcePortfolio: true,
      targetProposalReview: false,
      sourceProposalReview: false,
      targetSchedule: false,
      sourceSchedule: false,
    });

    const output = await makeUseCase().execute(makeAccess(), {
      targetLeadId: "target-1",
      sourceLeadId: "source-1",
    });

    expect(output.isValid).toBe(false);
    expect(output.errorMessages[0]).toContain("carteira");
    expect(mergeLeadsInTransactionMock).not.toHaveBeenCalled();
    expect(mergeProfilesMock).not.toHaveBeenCalled();
  });

  it("falha quando lead de origem não existe", async () => {
    findByIdMock
      .mockResolvedValueOnce({ ...baseLead, id: "target-1" })
      .mockResolvedValueOnce(null);

    const output = await makeUseCase().execute(makeAccess(), {
      targetLeadId: "target-1",
      sourceLeadId: "missing",
    });

    expect(output.isValid).toBe(false);
    expect(output.errorMessages[0]).toContain("não encontrado");
  });

  it("falha quando leads pertencem a times diferentes", async () => {
    findByIdMock
      .mockResolvedValueOnce({ ...baseLead, id: "target-1", teamId: "team-1" })
      .mockResolvedValueOnce({ ...baseLead, id: "source-1", leadCode: "LF-SOURCE", teamId: "team-2" });

    const output = await makeUseCase().execute(makeAccess("team-1"), {
      targetLeadId: "target-1",
      sourceLeadId: "source-1",
    });

    expect(output.isValid).toBe(false);
    expect(output.errorMessages[0]).toContain("mesmo time");
  });
});
