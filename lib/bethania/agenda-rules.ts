export const AGENDA_EVENT_TYPES = [
  "schedule.created_or_rescheduled",
  "agenda.daily_0700",
  "meeting.follow_up_1h",
  "agenda.overdue_1500",
] as const;

export type AgendaEventType = (typeof AGENDA_EVENT_TYPES)[number];
export const DEFAULT_MEETING_DURATION_MINUTES = 30;

type DateValue = string | Date;

export type ScheduleChangeInput = {
  previousDate: DateValue | null;
  nextDate: DateValue;
  actorProfileId: string;
  recipientProfileId: string;
};

export type ScheduleChange = "created" | "rescheduled" | "unchanged";

export type ScheduleChangeClassification = {
  change: ScheduleChange;
  shouldNotify: boolean;
};

function toEpoch(value: DateValue, fieldName: string): number {
  const timestamp = value instanceof Date ? value.getTime() : Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw new TypeError(`${fieldName} must be a valid date`);
  }
  return timestamp;
}

function requireProfileId(value: string, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${fieldName} must be a non-empty profile ID`);
  }
  return value;
}

export function classifyScheduleChange(
  input: ScheduleChangeInput,
): ScheduleChangeClassification {
  const actorProfileId = requireProfileId(input.actorProfileId, "actorProfileId");
  const recipientProfileId = requireProfileId(
    input.recipientProfileId,
    "recipientProfileId",
  );
  const nextTime = toEpoch(input.nextDate, "nextDate");

  if (input.previousDate === null) {
    return {
      change: "created",
      shouldNotify: actorProfileId !== recipientProfileId,
    };
  }

  const previousTime = toEpoch(input.previousDate, "previousDate");
  if (previousTime === nextTime) {
    return { change: "unchanged", shouldNotify: false };
  }

  return {
    change: "rescheduled",
    shouldNotify: actorProfileId !== recipientProfileId,
  };
}

export function getMeetingEnd(
  meetingStart: DateValue,
  persistedDurationMinutes: number | null,
): string {
  const start = toEpoch(meetingStart, "meetingStart");
  const duration =
    persistedDurationMinutes ?? DEFAULT_MEETING_DURATION_MINUTES;
  if (!Number.isInteger(duration) || duration <= 0) {
    throw new TypeError("duration must be a positive integer number of minutes");
  }
  return new Date(start + duration * 60_000).toISOString();
}
