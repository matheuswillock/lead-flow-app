import { Output } from "@/lib/output";
import type { MeetingDurationMinutes } from "@/app/api/domain/teamScheduleSettings/meetingDuration";

export interface ITeamScheduleSettingsUseCase {
  get(teamId: string): Promise<Output>;
  update(input: { teamId: string; durationMinutes: MeetingDurationMinutes }): Promise<Output>;
}
