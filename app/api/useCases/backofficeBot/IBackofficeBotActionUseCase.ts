import type { Output } from "@/lib/output";

export type BotActionName =
  | "list_leads"
  | "lead_detail"
  | "agenda_today"
  | "list_tasks"
  | "add_note"
  | "upload_attachment"
  | "schedule_meeting"
  | "cancel_meeting"
  | "create_task"
  | "search_lead"
  | "team_digest";

export interface IBackofficeBotActionUseCase {
  executeAction(
    action: string,
    input: {
      userLinkId: string;
      teamId?: string | null;
      params?: Record<string, unknown>;
      flowId?: string | null;
      channelMessageId?: string | null;
    }
  ): Promise<Output>;
}
