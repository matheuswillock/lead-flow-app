import {
  handlePublicFormMetricEventsCallback,
  type PublicFormMetricQueuePayload,
} from "@/lib/queues/public-form-metric-events";

/**
 * Consumer push privado (trigger `queue/v2beta`) — PoC T1.
 * Não grava Postgres; apenas confirma recebimento/ack para Observability.
 * O consumer definitivo de `PublicFormMetricEvent` fica no T5.
 */
export const POST = handlePublicFormMetricEventsCallback(
  async (message: PublicFormMetricQueuePayload, metadata) => {
    console.info("[PublicFormMetricEventsQueue][POST] message received", {
      messageId: metadata.messageId,
      deliveryCount: metadata.deliveryCount,
      topicName: metadata.topicName,
      consumerGroup: metadata.consumerGroup,
      region: metadata.region,
      eventType: message?.eventType,
      eventKey: message?.eventKey,
      publicId: message?.publicId,
    });
  },
);
