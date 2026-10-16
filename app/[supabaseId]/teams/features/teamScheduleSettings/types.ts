export const TEAM_MEETING_DURATION_OPTIONS = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60] as const;

export type TeamMeetingDurationMinutes = (typeof TEAM_MEETING_DURATION_OPTIONS)[number];

export type TeamScheduleSettings = {
  durationMinutes: TeamMeetingDurationMinutes;
};
