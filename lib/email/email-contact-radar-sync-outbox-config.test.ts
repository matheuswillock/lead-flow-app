import { describe, expect, it } from "bun:test";
import {
  RADAR_EMAIL_CONTACT_SYNC_OUTBOX_DEFAULT_BATCH_SIZE,
  RADAR_OUTBOX_CRON_RUNS_PER_HOUR,
  RADAR_SYNC_DEFAULT_CONCURRENCY,
  estimateRadarOutboxThroughputPerHour,
  resolveRadarEmailContactSyncOutboxBatchSize,
  resolveRadarSyncConcurrency,
} from "./email-contact-radar-sync-outbox-config";

describe("email-contact-radar-sync-outbox-config", () => {
  it("usa defaults T4 (batch 250, concurrency 8)", () => {
    expect(resolveRadarEmailContactSyncOutboxBatchSize({})).toBe(
      RADAR_EMAIL_CONTACT_SYNC_OUTBOX_DEFAULT_BATCH_SIZE
    );
    expect(resolveRadarSyncConcurrency({})).toBe(RADAR_SYNC_DEFAULT_CONCURRENCY);
  });

  it("respeita env e aplica teto", () => {
    expect(
      resolveRadarEmailContactSyncOutboxBatchSize({
        RADAR_EMAIL_CONTACT_SYNC_OUTBOX_BATCH_SIZE: "300",
      })
    ).toBe(300);
    expect(
      resolveRadarEmailContactSyncOutboxBatchSize({
        RADAR_EMAIL_CONTACT_SYNC_OUTBOX_BATCH_SIZE: "9999",
      })
    ).toBe(500);
    expect(
      resolveRadarSyncConcurrency({
        RADAR_SYNC_CONCURRENCY: "4",
      })
    ).toBe(4);
    expect(
      resolveRadarSyncConcurrency({
        RADAR_SYNC_CONCURRENCY: "99",
      })
    ).toBe(16);
  });

  it("ignora valores inválidos", () => {
    expect(
      resolveRadarEmailContactSyncOutboxBatchSize({
        RADAR_EMAIL_CONTACT_SYNC_OUTBOX_BATCH_SIZE: "0",
      })
    ).toBe(250);
    expect(
      resolveRadarSyncConcurrency({
        RADAR_SYNC_CONCURRENCY: "abc",
      })
    ).toBe(8);
  });

  it("estima throughput com cron */15 (4 ticks/hora)", () => {
    expect(RADAR_OUTBOX_CRON_RUNS_PER_HOUR).toBe(4);
    expect(estimateRadarOutboxThroughputPerHour(250)).toBe(1000);
  });
});
