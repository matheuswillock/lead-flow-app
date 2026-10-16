import type { MeetingDurationMinutes } from "@/app/api/domain/teamScheduleSettings/meetingDuration";

export interface ITeamScheduleSettingsRepository {
  findMeetingDuration(teamId: string): Promise<MeetingDurationMinutes | null>;
  updateMeetingDuration(input: {
    teamId: string;
    durationMinutes: MeetingDurationMinutes;
  }): Promise<MeetingDurationMinutes | null>;
}
