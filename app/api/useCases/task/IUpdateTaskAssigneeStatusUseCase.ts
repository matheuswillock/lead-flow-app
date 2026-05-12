import type { TaskAssigneeStatus } from "@prisma/client";
import type { Output } from "@/lib/output";

export type UpdateTaskAssigneeStatusInput = {
  taskId: string;
  assigneeProfileId: string;
  requestingProfileId: string;
  teamId: string;
  status: TaskAssigneeStatus;
};

export interface IUpdateTaskAssigneeStatusUseCase {
  execute(input: UpdateTaskAssigneeStatusInput): Promise<Output>;
}
