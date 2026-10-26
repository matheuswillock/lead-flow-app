import { teamWebhookInboundEventRepository } from "@/app/api/infra/data/repositories/teamWebhook/TeamWebhookInboundEventRepository";
import { processClaimedInboundWebhookEvents } from "./processInboundWebhookEventById";
import { RetryInboundWebhookEventsUseCase } from "./RetryInboundWebhookEventsUseCase";

export const retryInboundWebhookEventsUseCase = new RetryInboundWebhookEventsUseCase({
  events: teamWebhookInboundEventRepository,
  processBatch: processClaimedInboundWebhookEvents,
});
