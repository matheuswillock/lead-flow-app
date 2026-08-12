import { afterAll, beforeEach, describe, expect, it } from "bun:test";
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
});
