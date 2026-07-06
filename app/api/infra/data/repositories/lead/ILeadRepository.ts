import { Lead, LeadStatus, Prisma } from "@prisma/client";
import type { LeadCloserForCalendar, LeadForAttendeesRoleMap } from "@/app/api/v1/leads/[id]/schedule/attendees/ScheduleAttendeesTypes";

export type LeadRecord = Lead & {
  razaoSocial: string | null;
};

export type LeadCreateRepositoryInput = Prisma.LeadCreateInput & {
  razaoSocial?: string | null;
};

export type LeadUpdateRepositoryInput = Prisma.LeadUpdateInput & {
  razaoSocial?: string | null;
};

export type TransferToTeamSanitization = {
  leadId: string;
  clearEmail: boolean;
  clearCnpj: boolean;
};

export interface ILeadRepository {
  create(data: LeadCreateRepositoryInput): Promise<LeadRecord>;
  findById(id: string): Promise<LeadRecord | null>;
  findByLeadCode(leadCode: string): Promise<Lead | null>;
  findLeadByPhoneInTeam(teamId: string, normalizedPhone: string): Promise<Pick<Lead, "id"> | null>;
  /**
   * Localiza ou cria um lead para o telefone dentro de uma transação com
   * advisory lock por (teamId, normalizedPhone), evitando que mensagens
   * inbound concorrentes do WhatsApp criem leads duplicados para o mesmo
   * contato antes que a primeira criação seja visível para a segunda.
   */
  findOrCreateLeadByPhoneInTeam(params: {
    teamId: string;
    normalizedPhone: string;
    leadCode: string;
    displayName: string;
    masterId: string;
    conversationId: string;
  }): Promise<{ id: string; created: boolean }>;
  findByManagerId(
    managerId: string, 
    options?: {
      status?: LeadStatus;
      assignedTo?: string;
      page?: number;
      limit?: number;
      search?: string;
      startDate?: Date;
      endDate?: Date;
      onlyTransfer?: boolean;
    }
  ): Promise<{ leads: Lead[]; total: number }>;
  findAllByManagerId(
    managerId: string, 
    options?: {
      status?: LeadStatus;
      assignedTo?: string;
      search?: string;
      startDate?: Date;
      endDate?: Date;
      onlyTransfer?: boolean;
    }
  ): Promise<{ leads: Lead[] }>;
  findAllByTeamId(
    teamId: string,
    options?: {
      status?: LeadStatus;
      assignedTo?: string;
      search?: string;
      startDate?: Date;
      endDate?: Date;
      onlyTransfer?: boolean;
      calendarWindowStart?: Date;
      calendarWindowEnd?: Date;
    }
  ): Promise<{ leads: Lead[] }>;
  findAllByOperatorId(
    operatorId: string, 
    options?: {
      status?: LeadStatus;
      search?: string;
      startDate?: Date;
      endDate?: Date;
      onlyTransfer?: boolean;
    }
  ): Promise<{ leads: Lead[] }>;
  findAllByOperatorIdInTeam(
    operatorId: string,
    teamId: string,
    options?: {
      status?: LeadStatus;
      assignedTo?: string;
      search?: string;
      startDate?: Date;
      endDate?: Date;
      onlyTransfer?: boolean;
      calendarWindowStart?: Date;
      calendarWindowEnd?: Date;
    }
  ): Promise<{ leads: Lead[] }>;
  update(id: string, data: LeadUpdateRepositoryInput): Promise<LeadRecord>;
  delete(id: string): Promise<void>;
  updateStatus(id: string, status: LeadStatus, extraData?: Prisma.LeadUpdateInput): Promise<Lead>;
  assignToOperator(id: string, operatorId: string): Promise<Lead>;
  transferToManager(id: string, newManagerId: string, reason?: string): Promise<Lead>;
  transferToTeam(
    id: string,
    targetTeamId: string,
    closerId: string,
    sdrId: string | null,
    sanitizations?: TransferToTeamSanitization[],
    options?: { targetManagerId?: string }
  ): Promise<Lead>;
  getLeadsByStatus(managerId: string, status: LeadStatus): Promise<Lead[]>;
  reassignLeadsToMaster(deletedUserId: string, masterId: string): Promise<number>;
  /** Busca apenas os dados do closer com tokens OAuth — usado pelo calendário para RSVP do Google */
  findCloserForCalendar(leadId: string): Promise<LeadCloserForCalendar | null>;
  /** Busca os dados mínimos necessários para montar o roleMap de participantes */
  findForAttendeesRoleMap(leadId: string): Promise<LeadForAttendeesRoleMap | null>;
  /** Busca leads do time com email ou CNPJ em conflito — usado pela importação para dedupe */
  findImportConflicts(
    teamId: string,
    emails: string[],
    cnpjs: string[]
  ): Promise<Array<{ id: string; email: string | null; cnpj: string | null; status: LeadStatus | null }>>;
  findDuplicateDirectMatches(
    teamId: string,
    input: { phone?: string; email?: string; excludeLeadId?: string; limit?: number }
  ): Promise<LeadDuplicateCandidateRecord[]>;
  findDuplicateScanCandidates(
    teamId: string,
    input: { hasPhone: boolean; hasEmail: boolean; excludeLeadId?: string; limit?: number }
  ): Promise<LeadDuplicateCandidateRecord[]>;
  getMergeRelationSnapshot(
    targetLeadId: string,
    sourceLeadId: string
  ): Promise<LeadMergeRelationSnapshot>;
  mergeLeadsInTransaction(input: LeadMergeTransactionInput): Promise<void>;
}

export type LeadDuplicateCandidateRecord = {
  id: string;
  leadCode: string;
  name: string;
  phone: string | null;
  email: string | null;
  status: LeadStatus | null;
  createdAt: Date;
};

export type LeadMergeRecord = Pick<
  Lead,
  | "id"
  | "leadCode"
  | "teamId"
  | "isTransfer"
  | "email"
  | "phone"
  | "cnpj"
  | "razaoSocial"
  | "age"
  | "currentHealthPlan"
  | "currentValue"
  | "referenceHospital"
  | "currentTreatment"
  | "notes"
  | "soldPlan"
  | "ticket"
  | "contractDueDate"
  | "referrerName"
  | "referrerPhone"
  | "meetingTitle"
  | "meetingNotes"
  | "meetingLink"
  | "meetingType"
>;

export type LeadMergeRelationSnapshot = {
  targetPortfolio: boolean;
  sourcePortfolio: boolean;
  targetProposalReview: boolean;
  sourceProposalReview: boolean;
  targetSchedule: boolean;
  sourceSchedule: boolean;
};

export type LeadMergeTransactionInput = {
  targetLead: LeadMergeRecord;
  sourceLead: LeadMergeRecord;
  fillPatch: Prisma.LeadUpdateInput;
  mergedByProfileId: string;
  migratePortfolio: boolean;
  migrateProposalReview: boolean;
};
