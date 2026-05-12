import type { Output } from "@/lib/output";

export type CreateTaskInput = {
  leadId: string;
  teamId: string;
  creatorProfileId: string;
  body: string;
  isUrgent: boolean;
  startAt: Date | null;
  endAt: Date | null;
  assigneeProfileIds: string[];
};

export interface ICreateTaskUseCase {
  execute(input: CreateTaskInput): Promise<Output>;
}
