const EVENT_TYPE_TO_PREFERENCE: Record<string, string> = {
  "meeting.reminder_30m": "meeting_reminder",
  "meeting.reminder_5m": "meeting_reminder",
  "task.due_today": "task_due",
  "task.overdue": "task_overdue",
  "lead.assigned": "lead_assigned",
  "lead.status_changed": "lead_status_changed",
}

export function mapEventTypeToPreferenceType(eventType: string): string {
  return EVENT_TYPE_TO_PREFERENCE[eventType] ?? eventType
}
