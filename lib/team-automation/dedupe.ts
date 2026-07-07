import type { TeamAutomationEvent } from "./types";

export function buildAutomationDedupeKey(event: TeamAutomationEvent): string {
  const data = event.data ?? {};

  switch (event.type) {
    case "lead_created":
      return `lead_created:${event.leadId}`;
    case "status_changed": {
      const status = String(data.newStatus ?? data.status ?? "");
      const enteredAt = String(data.statusEnteredAt ?? "");
      return `status_changed:${status}:${enteredAt}`;
    }
    case "lead_idle_in_status": {
      const status = String(data.status ?? "");
      const enteredAt = String(data.statusEnteredAt ?? "");
      return `idle:${status}:${enteredAt}`;
    }
    case "meeting_scheduled":
      return `meeting_scheduled:${String(data.scheduleId ?? data.meetingDate ?? event.leadId)}`;
    case "meeting_no_show":
      return `meeting_no_show:${String(data.statusEnteredAt ?? event.leadId)}`;
    default: {
      const _exhaustive: never = event.type;
      return _exhaustive;
    }
  }
}
