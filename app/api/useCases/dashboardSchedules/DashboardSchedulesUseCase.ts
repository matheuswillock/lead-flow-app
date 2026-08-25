import { Output } from "@/lib/output";
import { leadScheduleRepository } from "@/app/api/infra/data/repositories/leadSchedule/LeadScheduleRepository";
import type {
  DayAgendaScheduleRow,
  ILeadScheduleRepository,
} from "@/app/api/infra/data/repositories/leadSchedule/ILeadScheduleRepository";
import type {
  IDashboardSchedulesUseCase,
  ListDayAgendaInput,
} from "./IDashboardSchedulesUseCase";

const UNASSIGNED_LABEL = "Não atribuído";

/** Achata o agendamento no formato que o widget de agenda consome. */
function toDayAgendaItem(schedule: DayAgendaScheduleRow) {
  const { lead } = schedule;

  return {
    id: schedule.id,
    date: schedule.date,
    leadName: lead.name,
    leadEmail: lead.email || "",
    leadPhone: lead.phone || "",
    responsible: lead.assignee?.fullName || lead.manager?.fullName || UNASSIGNED_LABEL,
    responsibleEmail: lead.assignee?.email || lead.manager?.email || "",
    closerName: lead.closer?.fullName || UNASSIGNED_LABEL,
    closerEmail: lead.closer?.email || "",
    meetingHeald: lead.meetingHeald,
    meetingPresenceConfirmed: lead.meetingPresenceConfirmed === true,
    teamName: lead.team?.name ?? "",
    teamId: lead.team?.id ?? "",
    meetingTitle: schedule.meetingTitle,
    notes: schedule.notes,
    meetingLink: schedule.meetingLink,
    leadId: schedule.leadId,
  };
}

export class DashboardSchedulesUseCase implements IDashboardSchedulesUseCase {
  constructor(private readonly schedules: ILeadScheduleRepository) {}

  async listDayAgenda(input: ListDayAgendaInput): Promise<Output> {
    try {
      const { reference } = input;
      const dayStart = new Date(
        reference.getFullYear(),
        reference.getMonth(),
        reference.getDate(),
        0,
        0,
        0
      );
      const dayEnd = new Date(
        reference.getFullYear(),
        reference.getMonth(),
        reference.getDate(),
        23,
        59,
        59
      );

      const rows = await this.schedules.findDayAgendaByTeams({
        teamIds: input.teamIds,
        restrictToProfileId: input.restrictToProfileId,
        dayStart,
        dayEnd,
      });

      return new Output(true, [], [], rows.map(toDayAgendaItem));
    } catch (error) {
      console.error("[DashboardSchedulesUseCase][listDayAgenda] Erro:", error);
      return new Output(false, [], ["Erro interno do servidor"], null);
    }
  }
}

export const dashboardSchedulesUseCase = new DashboardSchedulesUseCase(leadScheduleRepository);
