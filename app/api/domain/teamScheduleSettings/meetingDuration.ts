export const MEETING_DURATION_OPTIONS = [
  5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60,
] as const;

export type MeetingDurationMinutes = (typeof MEETING_DURATION_OPTIONS)[number];

export const DEFAULT_MEETING_DURATION_MINUTES: MeetingDurationMinutes = 30;

export function isMeetingDurationMinutes(value: unknown): value is MeetingDurationMinutes {
  return typeof value === "number" && MEETING_DURATION_OPTIONS.includes(value as MeetingDurationMinutes);
}
