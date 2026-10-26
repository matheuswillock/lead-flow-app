import { Output } from "@/lib/output";
import { leadRepository } from "@/app/api/infra/data/repositories/lead/LeadRepository";
import type { ILeadRepository, LeadScheduleContext } from "@/app/api/infra/data/repositories/lead/ILeadRepository";
import { leadScheduleRepository } from "@/app/api/infra/data/repositories/leadSchedule/LeadScheduleRepository";
import type { ILeadScheduleRepository } from "@/app/api/infra/data/repositories/leadSchedule/ILeadScheduleRepository";
import { leadScheduleService } from "@/app/api/services/leadSchedule/LeadScheduleService";
import type { ILeadScheduleService } from "@/app/api/services/leadSchedule/ILeadScheduleService";
import { isPreScheduleSlotAvailable } from "@/app/api/services/preSchedule/PreScheduleSlotService";
import { normalizeExtraGuests } from "@/lib/scheduling/meetingInputValidation";
import { PreScheduleSlotConflictError } from "@/app/api/domain/preSchedule/PreScheduleSlotConflictError";

type ScheduleAccess = { teamId: string; profileId: string };

export type ScheduleLeadInput = {
  leadId: string;
  access: ScheduleAccess;
  date?: string;
  meetingTitle?: string;
  notes?: string;
  meetingLink?: string;
  meetingType?: "online" | "call" | "whatsapp";
  closerId?: string;
  extraGuests?: string[];
  transitionStatusToScheduled?: boolean;
  confirmNoShowSchedule?: boolean;
};

export class LeadScheduleUseCase {
  constructor(
    private readonly leads: ILeadRepository = leadRepository,
    private readonly schedules: ILeadScheduleRepository = leadScheduleRepository,
    private readonly scheduleService: ILeadScheduleService = leadScheduleService,
  ) {}

  async get(leadId: string, access: ScheduleAccess): Promise<Output> {
    const lead = await this.leads.findAuthorizationSnapshotById(leadId);
    if (!lead || lead.teamId !== access.teamId) {
      return new Output(false, [], ["Lead não encontrado ou sem permissão no seu time."], null);
    }
    return new Output(true, [], [], await this.schedules.findByLeadId(leadId));
  }

  async execute(input: ScheduleLeadInput): Promise<Output> {
    const lead = await this.leads.findScheduleContextById(input.leadId);
    if (!lead || lead.teamId !== input.access.teamId) {
      return new Output(false, [], ["Lead não encontrado ou sem permissão no seu time."], null);
    }

    const existingSchedule = await this.schedules.findLatestByLeadId(lead.id);
    if (lead.isTransfer) {
      return this.saveTransferPreSchedule(lead, input, existingSchedule !== null);
    }

    const closerId = input.closerId ?? lead.closerId;
    if (!closerId) return new Output(false, [], ["Selecione um closer para a reunião."], null);
    if (!lead.status) {
      return new Output(false, [], ["Finalize o lead antes de agendar uma reunião completa."], null);
    }
    const normalizedGuests = normalizeExtraGuests(input.extraGuests);
    if (!normalizedGuests.valid) return new Output(false, [], [normalizedGuests.error], null);

    const output = await this.scheduleService.createSchedule({
      leadId: lead.id,
      leadName: lead.name,
      leadEmail: lead.email,
      leadStatus: lead.status,
      leadManagerId: lead.managerId,
      leadAssignedTo: lead.assignedTo,
      leadAssigneeEmail: lead.assignee?.email ?? null,
      leadCurrentCloserId: lead.closerId,
      leadMeetingLink: lead.meetingLink,
      leadCode: lead.leadCode,
      closerId,
      teamId: input.access.teamId,
      meetingDate: input.date,
      meetingTitle: input.meetingTitle ?? "",
      meetingNotes: input.notes,
      meetingLink: input.meetingLink,
      meetingType: input.meetingType ?? this.resolveMeetingType(lead.meetingType),
      extraGuests: normalizedGuests.guests,
      createdByProfileId: input.access.profileId,
      transitionStatusToScheduled: input.transitionStatusToScheduled,
      confirmNoShowSchedule: input.confirmNoShowSchedule,
    });
    return output;
  }

  private async saveTransferPreSchedule(
    lead: LeadScheduleContext,
    input: ScheduleLeadInput,
    alreadyScheduled: boolean,
  ): Promise<Output> {
    if (!input.date) return new Output(false, [], ["Data do pré-agendamento é obrigatória."], null);
    const meetingDate = new Date(input.date);
    if (Number.isNaN(meetingDate.getTime())) {
      return new Output(false, [], ["Data do pré-agendamento inválida."], null);
    }
    if (!lead.teamId) {
      return new Output(false, [], ["Lead sem time para pré-agendamento."], null);
    }
    const availability = await isPreScheduleSlotAvailable(lead.teamId, meetingDate, undefined, lead.id);
    if (!availability.available) {
      return new Output(false, [], ["Este horário de pré-agendamento já está lotado."], null);
    }
    const meetingTitle = input.meetingTitle?.trim() || `Estudo Plano de Saúde: ${lead.name}`;
    const meetingType = input.meetingType ?? this.resolveMeetingType(lead.meetingType) ?? "online";
    const normalizedGuests = normalizeExtraGuests(input.extraGuests);
    if (!normalizedGuests.valid) return new Output(false, [], [normalizedGuests.error], null);
    let schedule: Awaited<ReturnType<ILeadScheduleRepository["saveTransferPreSchedule"]>>;
    try {
      schedule = await this.schedules.saveTransferPreSchedule({
        leadId: lead.id,
        date: meetingDate,
        meetingTitle,
        notes: input.notes ?? null,
        meetingType,
        extraGuests: normalizedGuests.guests,
      });
    } catch (error) {
      if (error instanceof PreScheduleSlotConflictError) {
        return new Output(false, [], [error.message], null);
      }
      throw error;
    }
    return new Output(true, ["Pré-agendamento salvo com sucesso"], [], {
      ...schedule,
      status: lead.status,
      alreadyScheduled,
    });
  }

  private resolveMeetingType(value: string | null): "online" | "call" | "whatsapp" | null {
    return value === "online" || value === "call" || value === "whatsapp" ? value : null;
  }
}

export const leadScheduleUseCase = new LeadScheduleUseCase();
