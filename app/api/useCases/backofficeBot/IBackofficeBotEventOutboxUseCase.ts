import type { Output } from "@/lib/output";
import type { StudioBotEventOutboxPayload } from "@/lib/studio-bot/types";

export interface IBackofficeBotEventOutboxUseCase {
  enqueueEvent(input: StudioBotEventOutboxPayload, idempotencyKey: string): Promise<Output>;
  dispatchPending(limit?: number): Promise<Output>;
}
