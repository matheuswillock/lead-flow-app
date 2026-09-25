import type { TeamWebhookDestinationPreset, TeamWebhookEventKey } from "@prisma/client";
import {
  wrapOutboundPayloadForPreset,
  type OutboundWebhookEnvelope,
} from "./webhookPayloadPresets";

const EXAMPLE_EVENT_DATA: Record<TeamWebhookEventKey, Record<string, unknown>> = {
  lead_created: {
    lead: {
      id: "lead_exemplo",
      leadCode: "LEAD-001",
      name: "Ana Souza",
      status: "new_opportunity",
      email: "ana@example.com",
      phone: "+5511999999999",
    },
  },
  lead_status_changed: {
    lead: {
      id: "lead_exemplo",
      name: "Ana Souza",
      status: "scheduled",
      previous_status: "new_opportunity",
    },
  },
  lead_assigned: {
    lead: { id: "lead_exemplo", name: "Ana Souza" },
    assigned_to: "profile_responsavel",
    previous_assigned_to: null,
  },
  appointment_created: {
    schedule: {
      id: "schedule_exemplo",
      meeting_date: "2026-09-25T15:00:00.000Z",
    },
  },
  appointment_reminder: {
    lead: { id: "lead_exemplo", name: "Ana Souza", leadCode: "LEAD-001" },
    schedule: {
      id: "schedule_exemplo",
      meeting_date: "2026-09-25T15:00:00.000Z",
      meeting_link: "https://meet.example.com/reuniao",
    },
  },
  activity_created: {
    lead: { id: "lead_exemplo", leadCode: "LEAD-001", name: "Ana Souza" },
    activity: {
      id: "activity_exemplo",
      type: "note",
      body: "Cliente solicitou retorno amanhã.",
    },
  },
};

export function buildOutboundPayloadExample(
  eventKey: TeamWebhookEventKey,
  preset: TeamWebhookDestinationPreset
): unknown {
  const envelope: OutboundWebhookEnvelope = {
    id: "evt_exemplo",
    type: eventKey,
    created_at: "2026-09-24T12:00:00.000Z",
    team_id: "team_exemplo",
    data: {
      ...EXAMPLE_EVENT_DATA[eventKey],
      lead_id: "lead_exemplo",
    },
  };

  return wrapOutboundPayloadForPreset(preset, envelope);
}
