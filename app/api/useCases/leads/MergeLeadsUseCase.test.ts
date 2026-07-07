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

describe("MergeLeadsUseCase", () => {
  beforeEach(() => {
    findByIdMock.mockReset();
    getMergeRelationSnapshotMock.mockReset();
    mergeLeadsInTransactionMock.mockReset();
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

    const useCase = new MergeLeadsUseCase({
      findById: findByIdMock,
      getMergeRelationSnapshot: getMergeRelationSnapshotMock,
      mergeLeadsInTransaction: mergeLeadsInTransactionMock,
    } as never);
    const output = await useCase.execute(makeAccess(), {
      targetLeadId: "target-1",
      sourceLeadId: "source-1",
    });

    expect(output.isValid).toBe(true);
    expect(mergeLeadsInTransactionMock).toHaveBeenCalled();
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

    const useCase = new MergeLeadsUseCase({
      findById: findByIdMock,
      getMergeRelationSnapshot: getMergeRelationSnapshotMock,
      mergeLeadsInTransaction: mergeLeadsInTransactionMock,
    } as never);
    const output = await useCase.execute(makeAccess(), {
      targetLeadId: "target-1",
      sourceLeadId: "source-1",
    });

    expect(output.isValid).toBe(false);
    expect(output.errorMessages[0]).toContain("carteira");
    expect(mergeLeadsInTransactionMock).not.toHaveBeenCalled();
  });

  it("falha quando lead de origem não existe", async () => {
    findByIdMock
      .mockResolvedValueOnce({ ...baseLead, id: "target-1" })
      .mockResolvedValueOnce(null);

    const useCase = new MergeLeadsUseCase({
      findById: findByIdMock,
      getMergeRelationSnapshot: getMergeRelationSnapshotMock,
      mergeLeadsInTransaction: mergeLeadsInTransactionMock,
    } as never);
    const output = await useCase.execute(makeAccess(), {
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

    const useCase = new MergeLeadsUseCase({
      findById: findByIdMock,
      getMergeRelationSnapshot: getMergeRelationSnapshotMock,
      mergeLeadsInTransaction: mergeLeadsInTransactionMock,
    } as never);
    const output = await useCase.execute(makeAccess("team-1"), {
      targetLeadId: "target-1",
      sourceLeadId: "source-1",
    });

    expect(output.isValid).toBe(false);
    expect(output.errorMessages[0]).toContain("mesmo time");
  });
});
