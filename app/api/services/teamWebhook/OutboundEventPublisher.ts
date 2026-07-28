import { randomUUID } from "node:crypto";
import type { Prisma, TeamWebhookEventKey } from "@prisma/client";
import { teamWebhookRepository } from "@/app/api/infra/data/repositories/teamWebhook/TeamWebhookRepository";
import { teamWebhookOutboxRepository } from "@/app/api/infra/data/repositories/teamWebhook/TeamWebhookOutboxRepository";

export type OutboundDomainEvent = {
  teamId: string;
  eventKey: TeamWebhookEventKey;
  occurredAt?: string;
  leadId?: string;
  payload: Record<string, unknown>;
};

export interface IOutboundEventPublisher {
  publish(event: OutboundDomainEvent): Promise<void>;
}

export class OutboundEventPublisher implements IOutboundEventPublisher {
  async publish(event: OutboundDomainEvent): Promise<void> {
    try {
      const webhooks = await teamWebhookRepository.findActiveOutboundForEvent(
        event.teamId,
        event.eventKey
      );

      if (webhooks.length === 0) {
        return;
      }

      const occurredAt = event.occurredAt ?? new Date().toISOString();
      const envelope = {
        id: `evt_${randomUUID()}`,
        type: event.eventKey,
        created_at: occurredAt,
        team_id: event.teamId,
        data: {
          ...event.payload,
          ...(event.leadId ? { lead_id: event.leadId } : {}),
        },
      };

      await Promise.all(
        webhooks.map((webhook) =>
          teamWebhookOutboxRepository.enqueue({
            teamId: event.teamId,
            webhookId: webhook.id,
            eventKey: event.eventKey,
            payload: envelope as unknown as Prisma.InputJsonValue,
          })
        )
      );

      console.info("[OutboundEventPublisher] Eventos enfileirados", {
        teamId: event.teamId,
        eventKey: event.eventKey,
        count: webhooks.length,
      });
    } catch (error) {
      console.error("[OutboundEventPublisher] Erro ao publicar evento:", error);
    }
  }
}

export const outboundEventPublisher = new OutboundEventPublisher();
