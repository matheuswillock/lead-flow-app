import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";
import type { TeamWebhookOutboxClaimRow } from "@/app/api/infra/data/repositories/teamWebhook/ITeamWebhookOutboxRepository";
import { ProcessWebhookOutboxUseCase } from "./ProcessWebhookOutboxUseCase";

function makeClaimRow(id: string): TeamWebhookOutboxClaimRow {
  return {
    id,
    teamId: "team-1",
    webhookId: "webhook-1",
    eventKey: "lead_created",
    payload: {
      eventKey: "lead_created",
      occurredAt: "2026-08-12T12:00:00.000Z",
      data: {},
    },
    status: "processing",
    attemptCount: 0,
    nextAttemptAt: new Date("2026-08-12T12:00:00.000Z"),
  };
}

describe("ProcessWebhookOutboxUseCase", () => {
  const previousConcurrency = process.env.TEAM_WEBHOOK_OUTBOX_CONCURRENCY;

  beforeEach(() => {
    process.env.TEAM_WEBHOOK_OUTBOX_CONCURRENCY = "2";
  });

  afterAll(() => {
    if (previousConcurrency === undefined) {
      delete process.env.TEAM_WEBHOOK_OUTBOX_CONCURRENCY;
    } else {
      process.env.TEAM_WEBHOOK_OUTBOX_CONCURRENCY = previousConcurrency;
    }
  });

  it("respeita concorrência máxima ao processar múltiplas linhas", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    let deliverCalls = 0;

    const outboxRepository = {
      claimDue: async () => Array.from({ length: 5 }, (_, i) => makeClaimRow(`outbox-${i}`)),
      markDelivered: async () => {},
      markFailed: async () => {},
      requeueIfProcessing: async () => {},
      cancelPendingForWebhook: async () => {},
    };

    const webhookRepository = {
      findForDelivery: async () => ({
        id: "webhook-1",
        teamId: "team-1",
        name: "Hook",
        status: "active",
        targetUrl: "https://example.com/hook",
        destinationPreset: "generic",
        failureStreak: 0,
        failureThreshold: 5,
        updatedByProfileId: "profile-1",
      }),
      resetFailureStreak: async () => {},
      incrementFailureStreak: async () => ({
        failureStreak: 1,
        failureThreshold: 5,
      }),
      markPausedByFailures: async () => {},
      findTeamMasterId: async () => null,
      createAutoPausedNotification: async () => {},
    };

    const eventLogRepository = {
      create: async () => {},
    };

    const deliveryService = {
      deliver: async () => {
        deliverCalls += 1;
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((r) => setTimeout(r, 15));
        inFlight -= 1;
        return {
          ok: true,
          statusCode: 200,
          responseBody: { ok: true },
          errorMessage: null,
        };
      },
    };

    const useCase = new ProcessWebhookOutboxUseCase(
      outboxRepository as never,
      webhookRepository as never,
      eventLogRepository as never,
      deliveryService as never
    );
    const output = await useCase.execute();

    expect(output.isValid).toBe(true);
    expect(deliverCalls).toBe(5);
    expect(maxInFlight).toBeLessThanOrEqual(2);
    expect(maxInFlight).toBeGreaterThan(1);
  });

  it("registra a entrega e marca o item como entregue quando o destino aceita o payload", async () => {
    const row = makeClaimRow("outbox-success");
    const markDelivered = mock(async () => {});
    const createLog = mock(async () => {});
    const resetFailureStreak = mock(async () => {});
    const deliveryService = {
      deliver: mock(async () => ({
        ok: true,
        statusCode: 202,
        responseBody: { accepted: true },
        errorMessage: null,
      })),
    };
    const useCase = new ProcessWebhookOutboxUseCase(
      {
        claimDue: async () => [row],
        markDelivered,
        markFailed: async () => {},
        requeueIfProcessing: async () => {},
        cancelPendingForWebhook: async () => {},
      } as never,
      {
        findForDelivery: async () => ({
          id: "webhook-1",
          teamId: "team-1",
          name: "Hook",
          status: "active",
          targetUrl: "https://example.com/hook",
          destinationPreset: "generic",
          failureStreak: 0,
          failureThreshold: 5,
          updatedByProfileId: "profile-1",
        }),
        resetFailureStreak,
      } as never,
      { create: createLog } as never,
      deliveryService as never
    );

    const output = await useCase.execute();

    expect(output.isValid).toBe(true);
    expect(markDelivered).toHaveBeenCalledWith("outbox-success");
    expect(resetFailureStreak).toHaveBeenCalledWith("webhook-1");
    expect(createLog).toHaveBeenCalledWith(
      expect.objectContaining({
        result: "success",
        eventKey: "lead_created",
        statusCode: 202,
        requestPayload: row.payload,
        responsePayload: { accepted: true },
      })
    );
  });

  it("registra a falha, incrementa o contador e agenda nova tentativa", async () => {
    const row = makeClaimRow("outbox-failure");
    const markFailed = mock(
      async (_id: string, _attemptCount: number, _nextAttemptAt: Date | null, _error: string) => {}
    );
    const createLog = mock(async () => {});
    const incrementFailureStreak = mock(async () => ({
      failureStreak: 1,
      failureThreshold: 5,
    }));
    const useCase = new ProcessWebhookOutboxUseCase(
      {
        claimDue: async () => [row],
        markDelivered: async () => {},
        markFailed,
        requeueIfProcessing: async () => {},
        cancelPendingForWebhook: async () => {},
      } as never,
      {
        findForDelivery: async () => ({
          id: "webhook-1",
          teamId: "team-1",
          name: "Hook",
          status: "active",
          targetUrl: "https://example.com/hook",
          destinationPreset: "generic",
          failureStreak: 0,
          failureThreshold: 5,
          updatedByProfileId: "profile-1",
        }),
        incrementFailureStreak,
      } as never,
      { create: createLog } as never,
      {
        deliver: async () => ({
          ok: false,
          statusCode: 503,
          responseBody: "unavailable",
          errorMessage: "HTTP 503",
        }),
      } as never
    );

    await useCase.execute();

    expect(incrementFailureStreak).toHaveBeenCalledWith("webhook-1");
    expect(createLog).toHaveBeenCalledWith(
      expect.objectContaining({
        result: "failure",
        statusCode: 503,
        errorMessage: "HTTP 503",
      })
    );
    expect(markFailed).toHaveBeenCalledTimes(1);
    expect(markFailed.mock.calls[0]?.[0]).toBe("outbox-failure");
    expect(markFailed.mock.calls[0]?.[1]).toBe(1);
    expect(markFailed.mock.calls[0]?.[2]).toBeInstanceOf(Date);
    expect(markFailed.mock.calls[0]?.[3]).toBe("HTTP 503");
  });
});
