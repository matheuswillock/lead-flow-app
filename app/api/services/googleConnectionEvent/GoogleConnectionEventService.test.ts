import { describe, expect, test } from "bun:test";
import { GoogleConnectionEventType, GoogleConnectionFlow } from "@prisma/client";
import { GoogleConnectionEventService } from "./GoogleConnectionEventService";

describe("GoogleConnectionEventService", () => {
  test("persists a safe event and deduplicates by request and type", async () => {
    const entries: Array<Record<string, unknown>> = [];
    const service = new GoogleConnectionEventService({
      create: async (input) => {
        entries.push(input as unknown as Record<string, unknown>);
      },
    });

    await service.record({
      eventType: GoogleConnectionEventType.SUCCEEDED,
      flow: GoogleConnectionFlow.ACCOUNT,
      requestId: "req-1",
      metadata: { accessToken: "must-not-be-persisted", safe: true },
    });

    expect(entries).toHaveLength(1);
    expect(entries[0].dedupeKey).toBe("req-1:SUCCEEDED");
    expect(JSON.stringify(entries[0])).not.toContain("must-not-be-persisted");
  });
});
