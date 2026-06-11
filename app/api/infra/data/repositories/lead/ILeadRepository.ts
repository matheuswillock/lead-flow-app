import { Lead, LeadStatus, Prisma } from "@prisma/client";
import type { LeadCloserForCalendar, LeadForAttendeesRoleMap } from "@/app/api/v1/leads/[id]/schedule/attendees/ScheduleAttendeesTypes";

export interface ILeadRepository {
  create(data: Prisma.LeadCreateInput): Promise<Lead>;
  findById(id: string): Promise<Lead | null>;
  findByLeadCode(leadCode: string): Promise<Lead | null>;
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
    }
  ): Promise<{ leads: Lead[] }>;
  findAllByOperatorId(
    operatorId: string, 
    options?: {
      status?: LeadStatus;
      search?: string;
      startDate?: Date;
      endDate?: Date;
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
    }
  ): Promise<{ leads: Lead[] }>;
  update(id: string, data: Prisma.LeadUpdateInput): Promise<Lead>;
  delete(id: string): Promise<void>;
  updateStatus(id: string, status: LeadStatus, extraData?: Prisma.LeadUpdateInput): Promise<Lead>;
  assignToOperator(id: string, operatorId: string): Promise<Lead>;
  transferToManager(id: string, newManagerId: string, reason?: string): Promise<Lead>;
  transferToTeam(id: string, targetTeamId: string, closerId: string, sdrId: string | null): Promise<Lead>;
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
  ): Promise<Array<{ id: string; email: string | null; cnpj: string | null; status: LeadStatus }>>;
}
