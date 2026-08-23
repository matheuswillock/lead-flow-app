import type { Output } from "@/lib/output";

export interface ListDayAgendaInput {
  teamIds: string[];
  /** `null` para papeis manager-like, que enxergam a agenda do time inteiro. */
  restrictToProfileId: string | null;
  /** Referencia de "hoje" resolvida pelo caller, para o dia bater com o do usuario. */
  reference: Date;
}

export interface IDashboardSchedulesUseCase {
  /** Agenda do dia para o widget do dashboard. */
  listDayAgenda(input: ListDayAgendaInput): Promise<Output>;
}
