import { describe, expect, mock, test } from "bun:test";
import { OutboundEventPublisher } from "./OutboundEventPublisher";

const event = {
  teamId: "team-1",
  eventKey: "lead_created" as const,
  occurredAt: "2026-09-24T12:00:00.000Z",
  leadId: "lead-1",
  payload: { lead: { id: "lead-1", name: "Ana" } },
};

describe("OutboundEventPublisher", () => {
  test("enfileira um envelope para cada webhook ativo do evento", async () => {
    const enqueue = mock(async (_input: { webhookId: string }) => {});
    const publisher = new OutboundEventPublisher(
      {
        findActiveOutboundForEvent: async () => [
          { id: "webhook-1" },
          { id: "webhook-2" },
        ],
      } as never,
      { enqueue } as never
    );

    const result = await publisher.publish(event);

    expect(result).toEqual({ matchedWebhooks: 2, enqueuedWebhooks: 2, failedWebhooks: 0 });
    expect(enqueue).toHaveBeenCalledTimes(2);
    expect(enqueue.mock.calls[0]?.[0]).toMatchObject({
      teamId: "team-1",
      webhookId: "webhook-1",
      eventKey: "lead_created",
      payload: {
        type: "lead_created",
        created_at: "2026-09-24T12:00:00.000Z",
        team_id: "team-1",
        data: {
          lead_id: "lead-1",
          lead: { id: "lead-1", name: "Ana" },
        },
      },
    });
  });

  test("não lança quando um destino falha e devolve contagem observável", async () => {
    const enqueue = mock(async ({ webhookId }: { webhookId: string }) => {
      if (webhookId === "webhook-2") throw new Error("database unavailable");
    });
    const reportFailure = mock((_error: unknown, _context: Record<string, unknown>) => {});
    const publisher = new OutboundEventPublisher(
      {
        findActiveOutboundForEvent: async () => [
          { id: "webhook-1" },
          { id: "webhook-2" },
        ],
      } as never,
      { enqueue } as never,
      reportFailure
    );

    const result = await publisher.publish(event);

    expect(result).toEqual({ matchedWebhooks: 2, enqueuedWebhooks: 1, failedWebhooks: 1 });
    expect(reportFailure).toHaveBeenCalledTimes(1);
    expect(reportFailure.mock.calls[0]?.[1]).toMatchObject({
      teamId: "team-1",
      eventKey: "lead_created",
      matchedWebhooks: 2,
      failedWebhooks: 1,
    });
  });
});
