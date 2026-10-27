import { describe, expect, it, mock } from "bun:test";
import type { InboundEventRow } from "@/app/api/infra/data/repositories/teamWebhook/ITeamWebhookInboundEventRepository";
import {
  API_REQUEST_LOG_RETENTION_MS,
  INBOUND_EVENT_RETENTION_MS,
  INBOUND_RETRY_BATCH_SIZE,
  RetryInboundWebhookEventsUseCase,
} from "./RetryInboundWebhookEventsUseCase";

const NOW = new Date("2026-11-10T12:00:00.000Z");
const row = (id: string) => ({ id }) as InboundEventRow;

function build(overrides: { claimed?: InboundEventRow[]; claimError?: Error } = {}) {
  const claimDue = mock(async (_limit: number) => {
    if (overrides.claimError) throw overrides.claimError;
    return overrides.claimed ?? [];
  });
  const purgeTerminalOlderThan = mock(async (_cutoff: Date) => 2);
  const processBatch = mock(async (_rows: InboundEventRow[]) => undefined);
  return {
    claimDue,
    purgeTerminalOlderThan,
    processBatch,
    useCase: new RetryInboundWebhookEventsUseCase({
      events: { claimDue, purgeTerminalOlderThan },
      processBatch,
      now: () => NOW,
    }),
  };
}

describe("RetryInboundWebhookEventsUseCase (T-11.9)", () => {
  it("reivindica um lote limitado e entrega para processamento", async () => {
    const { useCase, claimDue, processBatch } = build({ claimed: [row("a"), row("b")] });
    const output = await useCase.execute();

    expect(claimDue).toHaveBeenCalledWith(INBOUND_RETRY_BATCH_SIZE);
    expect(processBatch.mock.calls[0]?.[0].map((event) => event.id)).toEqual(["a", "b"]);
    expect(output.isValid).toBe(true);
    expect(output.result).toEqual({ claimed: 2, purged: 2, purgedApiLogs: 0 });
  });

  it("sem eventos vencidos não aciona o processamento, mas ainda aplica a retenção", async () => {
    const { useCase, processBatch, purgeTerminalOlderThan } = build();
    const output = await useCase.execute();
    expect(processBatch).not.toHaveBeenCalled();
    expect(purgeTerminalOlderThan).toHaveBeenCalledTimes(1);
    expect(output.isValid).toBe(true);
  });

  it("a retenção apaga eventos terminais com mais de 7 dias", async () => {
    const { useCase, purgeTerminalOlderThan } = build();
    await useCase.execute();
    const cutoff = purgeTerminalOlderThan.mock.calls[0]?.[0] as Date;
    expect(cutoff.getTime()).toBe(NOW.getTime() - INBOUND_EVENT_RETENTION_MS);
    expect(INBOUND_EVENT_RETENTION_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("aplica a retenção de 30 dias do log de uso da API Studio no mesmo cron", async () => {
    const purgeOlderThan = mock(async (_cutoff: Date) => 7);
    const useCase = new RetryInboundWebhookEventsUseCase({
      events: { claimDue: async () => [], purgeTerminalOlderThan: async () => 0 },
      processBatch: async () => undefined,
      apiRequestLogs: { purgeOlderThan },
      now: () => NOW,
    });

    const output = await useCase.execute();

    expect((purgeOlderThan.mock.calls[0]?.[0] as Date).getTime()).toBe(NOW.getTime() - API_REQUEST_LOG_RETENTION_MS);
    expect(API_REQUEST_LOG_RETENTION_MS).toBe(30 * 24 * 60 * 60 * 1000);
    expect(output.result).toMatchObject({ purgedApiLogs: 7 });
  });

  it("falha na retenção do log de uso não derruba o reprocessamento", async () => {
    const original = console.error;
    console.error = () => undefined;
    try {
      const useCase = new RetryInboundWebhookEventsUseCase({
        events: { claimDue: async () => [], purgeTerminalOlderThan: async () => 0 },
        processBatch: async () => undefined,
        apiRequestLogs: { purgeOlderThan: async () => { throw new Error("banco indisponível"); } },
        now: () => NOW,
      });

      const output = await useCase.execute();

      expect(output.isValid).toBe(true);
      expect(output.result).toMatchObject({ purgedApiLogs: 0 });
    } finally {
      console.error = original;
    }
  });

  it("falha ao reivindicar vira Output inválido, sem derrubar o cron", async () => {
    const original = console.error;
    console.error = () => undefined;
    try {
      const { useCase } = build({ claimError: new Error("banco indisponível") });
      const output = await useCase.execute();
      expect(output.isValid).toBe(false);
    } finally {
      console.error = original;
    }
  });
});
