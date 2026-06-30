import { Output } from "@/lib/output";
import { backofficeBotRepository } from "@/app/api/infra/data/repositories/backofficeBot/BackofficeBotRepository";
import { studioBotN8nDispatchService } from "@/app/api/services/backofficeBot/StudioBotN8nDispatchService";
import type { StudioBotEventOutboxPayload } from "@/lib/studio-bot/types";
import type { IBackofficeBotEventOutboxUseCase } from "./IBackofficeBotEventOutboxUseCase";

export class BackofficeBotEventOutboxUseCase implements IBackofficeBotEventOutboxUseCase {
  async enqueueEvent(input: StudioBotEventOutboxPayload, idempotencyKey: string): Promise<Output> {
    try {
      const existing = await backofficeBotRepository.findOutboxEventByIdempotencyKey(idempotencyKey);
      if (existing) {
        return new Output(true, [], [], { cached: true, eventId: existing.id, status: existing.status });
      }

      const event = await backofficeBotRepository.createOutboxEvent({
        eventType: input.eventType,
        profileId: input.profileId,
        payload: input,
        idempotencyKey,
      });

      return new Output(true, ["Evento enfileirado"], [], { eventId: event.id, status: event.status });
    } catch (error) {
      console.error("[BackofficeBotEventOutboxUseCase][enqueueEvent]", error);
      return new Output(false, [], ["Erro ao enfileirar evento"], null);
    }
  }

  async dispatchPending(limit = 20): Promise<Output> {
    try {
      const outboundUrl = process.env.BACKOFFICE_N8N_OUTBOUND_URL?.trim();
      if (!outboundUrl) {
        return new Output(false, [], ["BACKOFFICE_N8N_OUTBOUND_URL não configurada"], null);
      }

      const events = await backofficeBotRepository.listPendingOutboxEvents(limit);
      const results: Array<{ eventId: string; ok: boolean; status: number }> = [];

      for (const event of events) {
        try {
          const dispatch = await studioBotN8nDispatchService.dispatchEvent(
            event.payload,
            event.idempotencyKey
          );

          if (dispatch.ok) {
            await backofficeBotRepository.updateOutboxEventStatus(event.id, "sent", new Date());
            results.push({ eventId: event.id, ok: true, status: dispatch.status });
          } else {
            await backofficeBotRepository.updateOutboxEventStatus(event.id, "failed");
            results.push({ eventId: event.id, ok: false, status: dispatch.status });
          }
        } catch {
          await backofficeBotRepository.updateOutboxEventStatus(event.id, "failed");
          results.push({ eventId: event.id, ok: false, status: 0 });
        }
      }

      return new Output(true, [], [], { dispatched: results.length, results });
    } catch (error) {
      console.error("[BackofficeBotEventOutboxUseCase][dispatchPending]", error);
      return new Output(false, [], ["Erro ao despachar eventos"], null);
    }
  }
}

export const backofficeBotEventOutboxUseCase = new BackofficeBotEventOutboxUseCase();
