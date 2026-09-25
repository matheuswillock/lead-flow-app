import { describe, expect, test } from "bun:test";
import { buildOutboundPayloadExample } from "./webhookPayloadExamples";

const eventKeys = [
  "lead_created",
  "lead_status_changed",
  "lead_assigned",
  "appointment_created",
  "appointment_reminder",
  "activity_created",
] as const;

describe("buildOutboundPayloadExample", () => {
  test.each([...eventKeys])("gera envelope genérico completo para %s", (eventKey) => {
    const payload = buildOutboundPayloadExample(eventKey, "generic") as Record<string, unknown>;

    expect(payload).toMatchObject({
      id: "evt_exemplo",
      type: eventKey,
      created_at: "2026-09-24T12:00:00.000Z",
      team_id: "team_exemplo",
    });
    expect(payload.data).toBeObject();
  });

  test("inclui os campos específicos de cada evento", () => {
    expect(buildOutboundPayloadExample("lead_created", "generic")).toMatchObject({
      data: { lead_id: "lead_exemplo", lead: { email: "ana@example.com" } },
    });
    expect(buildOutboundPayloadExample("lead_status_changed", "generic")).toMatchObject({
      data: { lead: { previous_status: "new_opportunity", status: "scheduled" } },
    });
    expect(buildOutboundPayloadExample("lead_assigned", "generic")).toMatchObject({
      data: { assigned_to: "profile_responsavel" },
    });
    expect(buildOutboundPayloadExample("appointment_created", "generic")).toMatchObject({
      data: { schedule: { id: "schedule_exemplo" } },
    });
    expect(buildOutboundPayloadExample("appointment_reminder", "generic")).toMatchObject({
      data: { schedule: { meeting_link: "https://meet.example.com/reuniao" } },
    });
    expect(buildOutboundPayloadExample("activity_created", "generic")).toMatchObject({
      data: { activity: { type: "note" } },
    });
  });

  test("aplica ao exemplo a transformação exata do preset", () => {
    expect(buildOutboundPayloadExample("lead_created", "zapier")).toMatchObject({
      type: "lead_created",
    });
    expect(buildOutboundPayloadExample("lead_created", "slack")).toMatchObject({
      text: "[Corretor Studio] lead_created: Ana Souza",
    });
    expect(buildOutboundPayloadExample("lead_created", "teams")).toMatchObject({
      "@type": "MessageCard",
      title: "lead_created",
    });
  });
});
