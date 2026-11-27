import { describe, expect, it } from "bun:test";
import { canDispatchBethaniaOutboxItem } from "./BethaniaOutboxEligibility";

const base = {
  phone: "+15551234567",
  verifiedAt: new Date("2026-11-23T00:00:00.000Z"),
  outboxPhone: "+15551234567",
  globalPaused: false,
  eventPaused: false,
  eventType: "agenda.daily_0700",
  message: "Agenda de hoje",
};

describe("canDispatchBethaniaOutboxItem", () => {
  it("allows verified phone with absent controls treated as unpaused", () => {
    expect(canDispatchBethaniaOutboxItem({ ...base, globalPaused: null, eventPaused: null })).toBe(true);
  });

  it("fails closed for changed or unverified numbers and active pauses", () => {
    expect(canDispatchBethaniaOutboxItem({ ...base, outboxPhone: "+15550000000" })).toBe(false);
    expect(canDispatchBethaniaOutboxItem({ ...base, verifiedAt: null })).toBe(false);
    expect(canDispatchBethaniaOutboxItem({ ...base, globalPaused: true })).toBe(false);
    expect(canDispatchBethaniaOutboxItem({ ...base, eventPaused: true })).toBe(false);
  });

  it("rejects unknown event types and blank payloads", () => {
    expect(canDispatchBethaniaOutboxItem({ ...base, eventType: "unknown.event" })).toBe(false);
    expect(canDispatchBethaniaOutboxItem({ ...base, message: " " })).toBe(false);
  });
});
