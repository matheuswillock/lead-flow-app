import type { Output } from "@/lib/output";
import type { TeamScopeVisibility } from "@/lib/teams/teamScopeVisibility";

export type ListTasksInput = {
  /**
   * Times do escopo com a restricao de papel POR TIME. Substituiu o `teamId`
   * unico: quem e membro de N times precisa enxergar os N no Calendario.
   */
  visibility: TeamScopeVisibility;
  dateFrom?: Date;
  dateTo?: Date;
  leadId?: string;
};

export interface IListTasksUseCase {
  execute(input: ListTasksInput): Promise<Output>;
}
