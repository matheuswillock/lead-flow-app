import { describe, expect, it, mock } from "bun:test";
import { BethaniaAgendaWorkerUseCase } from "./BethaniaAgendaWorkerUseCase";

describe("BethaniaAgendaWorkerUseCase", () => {
  it("queues due agenda events but does not claim delivery without sender config", async () => {
    const scheduleDueEvents = mock(async () => ({ profiles: 2, planned: 1, enqueued: 1 }));
    const dispatchDue = mock(async () => ({ accepted: 0, failed: 0, suppressed: 0 }));
    const worker = new BethaniaAgendaWorkerUseCase(
      { scheduleDueEvents } as never,
      { dispatchDue } as never,
      false,
    );
    const output = await worker.run(new Date("2026-11-23T10:00:00.000Z"));
    expect(output).toMatchObject({ isValid: true, successMessages: ["Bethania agenda worker completed"], errorMessages: [] });
    const result = output.result;
    expect(result).toEqual({
      scheduled: { profiles: 2, planned: 1, enqueued: 1 },
      delivery: { accepted: 0, failed: 0, suppressed: 0 },
      senderConfigured: false,
    });
    expect(dispatchDue).not.toHaveBeenCalled();
  });

  it("dispatches one bounded batch after persisting due events", async () => {
    const sequence: string[] = [];
    const agenda = { scheduleDueEvents: mock(async () => { sequence.push("schedule"); return { profiles: 1, planned: 0, enqueued: 0 }; }) };
    const outbox = { dispatchDue: mock(async (limit: number) => { sequence.push(`dispatch:${limit}`); return { accepted: 1, failed: 0, suppressed: 0 }; }) };
    const result = (await new BethaniaAgendaWorkerUseCase(agenda as never, outbox as never, true).run(new Date())).result;
    expect(sequence).toEqual(["schedule", "dispatch:50"]);
    expect(result.delivery.accepted).toBe(1);
  });
});
