import type { Output } from "@/lib/output";

export type ListTasksInput = {
  teamId: string;
  dateFrom?: Date;
  dateTo?: Date;
  leadId?: string;
};

export interface IListTasksUseCase {
  execute(input: ListTasksInput): Promise<Output>;
}
