import type { Output } from "@/lib/output";

export type CancelTaskInput = {
  taskId: string;
  requestingProfileId: string;
  teamId: string;
};

export interface ICancelTaskUseCase {
  execute(input: CancelTaskInput): Promise<Output>;
}
