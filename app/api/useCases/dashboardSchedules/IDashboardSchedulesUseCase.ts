import type { Output } from "@/lib/output";
import type { TeamScopeVisibility } from "@/lib/teams/teamScopeVisibility";

export interface ListDayAgendaInput {
  /** Times do escopo e restricao de papel POR TIME — ver `TeamScopeVisibility`. */
  visibility: TeamScopeVisibility;
  /** Referencia de "hoje" resolvida pelo caller, para o dia bater com o do usuario. */
  reference: Date;
}

export interface IDashboardSchedulesUseCase {
  /** Agenda do dia para o widget do dashboard. */
  listDayAgenda(input: ListDayAgendaInput): Promise<Output>;
}
