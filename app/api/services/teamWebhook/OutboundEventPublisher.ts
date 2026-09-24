import { randomUUID } from "node:crypto";
import type { Prisma, TeamWebhookEventKey } from "@prisma/client";
import * as Sentry from "@sentry/nextjs";
import { teamWebhookRepository } from "@/app/api/infra/data/repositories/teamWebhook/TeamWebhookRepository";
import { teamWebhookOutboxRepository } from "@/app/api/infra/data/repositories/teamWebhook/TeamWebhookOutboxRepository";
import type { ITeamWebhookRepository } from "@/app/api/infra/data/repositories/teamWebhook/ITeamWebhookRepository";
import type { ITeamWebhookOutboxRepository } from "@/app/api/infra/data/repositories/teamWebhook/ITeamWebhookOutboxRepository";

export type OutboundDomainEvent = {
  teamId: string;
  eventKey: TeamWebhookEventKey;
  occurredAt?: string;
  leadId?: string;
  payload: Record<string, unknown>;
};

export type OutboundEventPublishResult = {
  matchedWebhooks: number;
  enqueuedWebhooks: number;
  failedWebhooks: number;
};

export interface IOutboundEventPublisher {
  publish(event: OutboundDomainEvent): Promise<OutboundEventPublishResult>;
}

export class OutboundEventPublisher implements IOutboundEventPublisher {
  constructor(
    private readonly webhookRepository: Pick<ITeamWebhookRepository, "findActiveOutboundForEvent"> =
      teamWebhookRepository,
    private readonly outboxRepository: Pick<ITeamWebhookOutboxRepository, "enqueue"> =
      teamWebhookOutboxRepository,
    private readonly reportFailure: (error: unknown, context: Record<string, unknown>) => void =
      (error, context) => Sentry.captureException(error, { extra: context })
  ) {}

  async publish(event: OutboundDomainEvent): Promise<OutboundEventPublishResult> {
    try {
      const webhooks = await this.webhookRepository.findActiveOutboundForEvent(
        event.teamId,
        event.eventKey
      );

      if (webhooks.length === 0) {
        return { matchedWebhooks: 0, enqueuedWebhooks: 0, failedWebhooks: 0 };
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

      const enqueueResults = await Promise.allSettled(
        webhooks.map((webhook) =>
          this.outboxRepository.enqueue({
            teamId: event.teamId,
            webhookId: webhook.id,
            eventKey: event.eventKey,
            payload: envelope as unknown as Prisma.InputJsonValue,
          })
        )
      );

      const failedResults = enqueueResults.filter(
        (result): result is PromiseRejectedResult => result.status === "rejected"
      );
      const publishResult = {
        matchedWebhooks: webhooks.length,
        enqueuedWebhooks: enqueueResults.length - failedResults.length,
        failedWebhooks: failedResults.length,
      };

      for (const failure of failedResults) {
        this.reportFailure(failure.reason, {
          teamId: event.teamId,
          eventKey: event.eventKey,
          ...publishResult,
        });
      }

      console.info("[OutboundEventPublisher] Eventos enfileirados", {
        teamId: event.teamId,
        eventKey: event.eventKey,
        ...publishResult,
      });

      return publishResult;
    } catch (error) {
      const context = {
        teamId: event.teamId,
        eventKey: event.eventKey,
        matchedWebhooks: 0,
        enqueuedWebhooks: 0,
        failedWebhooks: 1,
      };
      console.error("[OutboundEventPublisher] Erro ao consultar destinos:", context, error);
      this.reportFailure(error, context);
      return {
        matchedWebhooks: 0,
        enqueuedWebhooks: 0,
        failedWebhooks: 1,
      };
    }
  }
}

export const outboundEventPublisher = new OutboundEventPublisher();
