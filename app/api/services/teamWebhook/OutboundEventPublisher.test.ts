import { beforeEach, describe, expect, it, mock } from "bun:test";

const findActiveOutboundForEventMock = mock(async () => [
  {
    id: "webhook-1",
    teamId: "team-1",
    targetUrl: "https://example.com/hook",
    destinationPreset: "generic" as const,
    failureStreak: 0,
    failureThreshold: 10,
    name: "Hook",
  },
]);
const enqueueMock = mock(async (_input: { payload: Record<string, unknown> }) => {});

mock.module(
  "@/app/api/infra/data/repositories/teamWebhook/TeamWebhookRepository",
  () => ({
    teamWebhookRepository: {
      findActiveOutboundForEvent: findActiveOutboundForEventMock,
    },
  })
);

mock.module(
  "@/app/api/infra/data/repositories/teamWebhook/TeamWebhookOutboxRepository",
  () => ({
    teamWebhookOutboxRepository: {
      enqueue: enqueueMock,
    },
  })
);

const { OutboundEventPublisher } = await import("./OutboundEventPublisher");

describe("OutboundEventPublisher", () => {
  beforeEach(() => {
    findActiveOutboundForEventMock.mockClear();
    enqueueMock.mockClear();
  });

  it("T-20.3: enfileira o envelope com version: 1 (campo aditivo)", async () => {
    const publisher = new OutboundEventPublisher();
    await publisher.publish({
      teamId: "team-1",
      eventKey: "lead_created",
      leadId: "lead-1",
      payload: { lead: { name: "Fulano" } },
    });

    expect(enqueueMock).toHaveBeenCalledTimes(1);
    const call = enqueueMock.mock.calls[0]?.[0] as { payload: Record<string, unknown> };
    const envelope = call.payload as {
      id: string;
      type: string;
      version: number;
      created_at: string;
      team_id: string;
      data: Record<string, unknown>;
    };

    expect(envelope.version).toBe(1);
    // Campos existentes continuam presentes — version é aditivo, não substitui nada.
    expect(envelope.id).toMatch(/^evt_/);
    expect(envelope.type).toBe("lead_created");
    expect(envelope.team_id).toBe("team-1");
    expect(envelope.data).toMatchObject({ lead: { name: "Fulano" }, lead_id: "lead-1" });
  });

  it("não enfileira nada quando não há webhook ativo para o evento", async () => {
    findActiveOutboundForEventMock.mockImplementationOnce(async () => []);
    const publisher = new OutboundEventPublisher();
    await publisher.publish({
      teamId: "team-1",
      eventKey: "lead_created",
      payload: {},
    });
    expect(enqueueMock).not.toHaveBeenCalled();
  });
});
