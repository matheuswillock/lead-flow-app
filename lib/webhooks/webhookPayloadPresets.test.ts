import { describe, expect, test } from "bun:test";
import { wrapOutboundPayloadForPreset } from "./webhookPayloadPresets";

const envelope = {
  id: "evt_1",
  type: "lead_created" as const,
  created_at: "2026-07-27T15:00:00.000Z",
  team_id: "team-1",
  data: { lead: { id: "l1", name: "Ana" } },
};

describe("wrapOutboundPayloadForPreset", () => {
  test("generic retorna envelope", () => {
    expect(wrapOutboundPayloadForPreset("generic", envelope)).toEqual(envelope);
  });

  test("slack inclui text", () => {
    const body = wrapOutboundPayloadForPreset("slack", envelope) as { text: string };
    expect(body.text).toContain("lead_created");
    expect(body.text).toContain("Ana");
  });

  test("teams inclui MessageCard", () => {
    const body = wrapOutboundPayloadForPreset("teams", envelope) as {
      "@type": string;
      title: string;
    };
    expect(body["@type"]).toBe("MessageCard");
    expect(body.title).toBe("lead_created");
  });
});
