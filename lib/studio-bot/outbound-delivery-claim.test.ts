import { describe, expect, test } from "bun:test";
import {
  OUTBOUND_DELIVERY_STALE_MS,
  isOutboundDeliveryClaimStale,
} from "./outbound-delivery-claim";

describe("outbound-delivery-claim", () => {
  test("claim recente não é stale", () => {
    const now = new Date("2026-07-20T12:00:00.000Z");
    const updatedAt = new Date(now.getTime() - 60_000);
    expect(isOutboundDeliveryClaimStale(updatedAt, now)).toBe(false);
  });

  test("claim após STALE_MS é reassumível", () => {
    const now = new Date("2026-07-20T12:00:00.000Z");
    const updatedAt = new Date(now.getTime() - OUTBOUND_DELIVERY_STALE_MS);
    expect(isOutboundDeliveryClaimStale(updatedAt, now)).toBe(true);
  });
});
