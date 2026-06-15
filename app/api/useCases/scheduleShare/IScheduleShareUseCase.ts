import type { Output } from "@/lib/output";

export interface IScheduleShareUseCase {
  createPublicShare(input: { leadId: string; teamId: string }): Promise<Output>;
  getPublicShare(token: string): Promise<Output>;
}
