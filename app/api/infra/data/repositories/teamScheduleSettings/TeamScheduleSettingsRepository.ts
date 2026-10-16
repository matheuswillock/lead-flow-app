import { prisma } from "../../prisma";
import type { MeetingDurationMinutes } from "@/app/api/domain/teamScheduleSettings/meetingDuration";
import type { ITeamScheduleSettingsRepository } from "./ITeamScheduleSettingsRepository";

export class TeamScheduleSettingsRepository implements ITeamScheduleSettingsRepository {
  async findMeetingDuration(teamId: string): Promise<MeetingDurationMinutes | null> {
    const team = await prisma.team.findFirst({
      where: { id: teamId, deletedAt: null },
      select: { meetingDurationMinutes: true },
    });

    return team?.meetingDurationMinutes as MeetingDurationMinutes | undefined ?? null;
  }

  async updateMeetingDuration(input: {
    teamId: string;
    durationMinutes: MeetingDurationMinutes;
  }): Promise<MeetingDurationMinutes | null> {
    const result = await prisma.team.updateMany({
      where: { id: input.teamId, deletedAt: null },
      data: { meetingDurationMinutes: input.durationMinutes },
    });

    return result.count === 1 ? input.durationMinutes : null;
  }
}

export const teamScheduleSettingsRepository = new TeamScheduleSettingsRepository();
