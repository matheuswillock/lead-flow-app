import type { Output } from "@/lib/output";

export interface IBackofficeBotContextUseCase {
  getContext(input: {
    userLinkId: string;
    teamId?: string | null;
  }): Promise<Output>;
}
