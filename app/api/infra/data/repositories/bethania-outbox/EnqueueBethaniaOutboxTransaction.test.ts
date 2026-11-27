import { describe, expect, it } from "bun:test";
import { enqueueBethaniaOutboxInTransaction } from "./EnqueueBethaniaOutboxTransaction";

function transaction(options: { phone?: string | null; verified?: Date | null; globallyPaused?: boolean; eventPaused?: boolean; duplicate?: boolean } = {}) {
  const created: any[] = [];
  const logs: any[] = [];
  let row: any = options.duplicate ? { id: "existing", status: "pending" } : null;
  return {
    created,
    logs,
    tx: {
      profile: { findUnique: async () => ({ whatsappPhone: options.phone ?? "+15551234567", whatsappPhoneVerifiedAt: options.verified === undefined ? new Date(0) : options.verified }) },
      bethaniaGlobalControl: { findUnique: async () => options.globallyPaused === undefined ? null : { paused: options.globallyPaused } },
      bethaniaEventControl: { findUnique: async () => options.eventPaused === undefined ? null : { paused: options.eventPaused } },
      bethaniaOutbox: {
        findUnique: async () => row,
        createMany: async ({ data }: { data: any[] }) => { created.push(...data); row = { id: "new-id", status: data[0].status }; return { count: options.duplicate ? 0 : 1 }; },
      },
      bethaniaDeliveryLog: { create: async ({ data }: { data: any }) => { logs.push(data); } },
    } as any,
  };
}

const event = {
  idempotencyKey: "agenda.daily_0700:profile-1:2026-11-23",
  profileId: "profile-1",
  eventType: "agenda.daily_0700" as const,
  message: "Agenda de hoje",
};

describe("enqueueBethaniaOutboxInTransaction", () => {
  it("persists the payload and a redacted pending log for a verified contact when controls are absent", async () => {
    const db = transaction();
    const result = await enqueueBethaniaOutboxInTransaction(db.tx, event);
    expect(result).toEqual({ id: "new-id", status: "pending" });
    expect(db.created[0]).toMatchObject({ profileId: "profile-1", phone: "+15551234567", message: "Agenda de hoje", status: "pending" });
    expect(db.logs).toEqual([{ outboxId: "new-id", recipientProfileId: "profile-1", eventType: "agenda.daily_0700", status: "pending", errorCode: null }]);
    expect(JSON.stringify(db.logs)).not.toContain("15551234567");
  });

  it("suppresses delivery when the contact is unverified or a pause is active", async () => {
    const unverified = transaction({ verified: null });
    const paused = transaction({ globallyPaused: true });
    expect((await enqueueBethaniaOutboxInTransaction(unverified.tx, event)).status).toBe("suppressed");
    expect((await enqueueBethaniaOutboxInTransaction(paused.tx, event)).status).toBe("suppressed");
    expect(unverified.created[0]).toMatchObject({ phone: null, message: null, status: "suppressed" });
    expect(paused.created[0]).toMatchObject({ phone: null, message: null, status: "suppressed" });
  });

  it("deduplicates an existing idempotency key without adding a second log", async () => {
    const db = transaction({ duplicate: true });
    const result = await enqueueBethaniaOutboxInTransaction(db.tx, event);
    expect(result).toEqual({ id: "existing", status: "pending" });
    expect(db.created).toHaveLength(0);
    expect(db.logs).toHaveLength(0);
  });
});
