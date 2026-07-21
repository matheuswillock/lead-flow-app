import type { Output } from "@/lib/output";
import type { StudioBotInboundWebhookBody } from "@/lib/studio-bot/types";

export interface IBackofficeBotInboundWebhookUseCase {
  handleInbound(
    body: StudioBotInboundWebhookBody,
    idempotencyKey?: string | null
  ): Promise<Output>;
}
