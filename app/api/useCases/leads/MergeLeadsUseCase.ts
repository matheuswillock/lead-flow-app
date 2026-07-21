import { Prisma } from "@prisma/client";
import { Output } from "@/lib/output";
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess";
import { leadRepository } from "@/app/api/infra/data/repositories/lead/LeadRepository";
import type { ILeadRepository, LeadMergeRecord } from "@/app/api/infra/data/repositories/lead/ILeadRepository";
import type { IMergeLeadsUseCase, MergeLeadsInput } from "./IMergeLeadsUseCase";

const FILLABLE_SCALAR_FIELDS = [
  "email",
  "phone",
  "cnpj",
  "razaoSocial",
  "age",
  "currentHealthPlan",
  "referenceHospital",
  "currentTreatment",
  "notes",
  "soldPlan",
  "referrerName",
  "referrerPhone",
  "meetingTitle",
  "meetingNotes",
  "meetingLink",
  "meetingType",
] as const;

function isEmptyValue(value: unknown): boolean {
  return value === null || value === undefined || value === "";
}

function buildFillPatch(target: LeadMergeRecord, source: LeadMergeRecord): Prisma.LeadUpdateInput {
  const patch: Prisma.LeadUpdateInput = {};

  for (const field of FILLABLE_SCALAR_FIELDS) {
    if (isEmptyValue(target[field]) && !isEmptyValue(source[field])) {
      patch[field] = source[field] as never;
    }
  }

  if (isEmptyValue(target.currentValue) && source.currentValue != null) {
    patch.currentValue = source.currentValue;
  }

  if (isEmptyValue(target.ticket) && source.ticket != null) {
    patch.ticket = source.ticket;
  }

  if (isEmptyValue(target.contractDueDate) && source.contractDueDate != null) {
    patch.contractDueDate = source.contractDueDate;
  }

  return patch;
}

export class MergeLeadsUseCase implements IMergeLeadsUseCase {
  constructor(private readonly repository: ILeadRepository = leadRepository) {}

  async execute(access: TeamAccess, input: MergeLeadsInput): Promise<Output> {
    if (input.targetLeadId === input.sourceLeadId) {
      return new Output(false, [], ["Não é possível mesclar um lead com ele mesmo"], null);
    }

    const [targetLead, sourceLead] = await Promise.all([
      this.repository.findById(input.targetLeadId),
      this.repository.findById(input.sourceLeadId),
    ]);

    if (!targetLead || !sourceLead) {
      return new Output(false, [], ["Lead não encontrado"], null);
    }

    if (targetLead.teamId !== access.teamId || sourceLead.teamId !== access.teamId) {
      return new Output(false, [], ["Leads devem pertencer ao mesmo time"], null);
    }

    if (sourceLead.isTransfer) {
      return new Output(
        false,
        [],
        ["O lead de origem está com transferência ativa. Conclua ou desative antes de mesclar."],
        null
      );
    }

    const relations = await this.repository.getMergeRelationSnapshot(targetLead.id, sourceLead.id);

    if (relations.targetPortfolio && relations.sourcePortfolio) {
      return new Output(
        false,
        [],
        [
          "Ambos os leads possuem carteira vinculada. Resolva manualmente qual registro manter antes de mesclar.",
        ],
        null
      );
    }

    if (relations.targetProposalReview && relations.sourceProposalReview) {
      return new Output(
        false,
        [],
        [
          "Ambos os leads possuem revisão de proposta. Resolva manualmente qual registro manter antes de mesclar.",
        ],
        null
      );
    }

    if (relations.targetSchedule && relations.sourceSchedule) {
      return new Output(
        false,
        [],
        [
          "Ambos os leads possuem agendamento vinculado. Resolva manualmente qual registro manter antes de mesclar.",
        ],
        null
      );
    }

    const fillPatch = buildFillPatch(targetLead, sourceLead);

    try {
      await this.repository.mergeLeadsInTransaction({
        targetLead,
        sourceLead,
        fillPatch,
        mergedByProfileId: access.profileId,
        migratePortfolio: !relations.targetPortfolio && relations.sourcePortfolio,
        migrateProposalReview: !relations.targetProposalReview && relations.sourceProposalReview,
      });
    } catch (error) {
      console.error("[MergeLeadsUseCase][execute]", error);
      return new Output(false, [], ["Não foi possível concluir a mesclagem dos leads"], null);
    }

    return new Output(
      true,
      ["Leads mesclados com sucesso"],
      [],
      {
        targetLeadId: targetLead.id,
        mergedLeadId: sourceLead.id,
        mergedLeadCode: sourceLead.leadCode,
      }
    );
  }
}

export const mergeLeadsUseCase = new MergeLeadsUseCase();
