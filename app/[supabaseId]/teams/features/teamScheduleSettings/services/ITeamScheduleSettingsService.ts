import type { TeamScheduleSettings, TeamMeetingDurationMinutes } from "../types";

export interface ITeamScheduleSettingsService {
  get(input: { supabaseId: string; teamId: string }): Promise<TeamScheduleSettings>;
  update(input: {
    supabaseId: string;
    teamId: string;
    durationMinutes: TeamMeetingDurationMinutes;
  }): Promise<TeamScheduleSettings>;
}
