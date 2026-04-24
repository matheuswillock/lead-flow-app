import { prisma } from "../../prisma";
import type {
  CalendarAvailabilityCloserProfile,
  CalendarAvailabilityExcludedLead,
  CalendarAvailabilityScheduledLead,
  ICalendarAvailabilityRepository,
} from "./ICalendarAvailabilityRepository";

export class CalendarAvailabilityRepository implements ICalendarAvailabilityRepository {
  async findTeamMemberProfileIds(teamId: string, requestedCloserIds: string[]): Promise<string[]> {
    const teamMembers = await prisma.teamMember.findMany({
      where: {
        teamId,
        profileId: { in: requestedCloserIds },
      },
      select: { profileId: true },
    });

    return teamMembers.map((item) => item.profileId);
  }

  async findCloserProfiles(requestedCloserIds: string[]): Promise<CalendarAvailabilityCloserProfile[]> {
    return prisma.profile.findMany({
      where: { id: { in: requestedCloserIds } },
      select: {
        id: true,
        email: true,
        timezone: true,
        googleCalendarConnected: true,
        googleRefreshToken: true,
        googleAccessToken: true,
        googleTokenExpiresAt: true,
        supabaseId: true,
      },
    });
  }

  async findExcludedLead(excludeLeadId: string, teamId: string): Promise<CalendarAvailabilityExcludedLead | null> {
    return prisma.lead.findFirst({
      where: {
        id: excludeLeadId,
        teamId,
      },
      select: {
        id: true,
        closerId: true,
        meetingDate: true,
      },
    });
  }

  async findScheduledLeadsForDay(params: {
    teamId: string;
    requestedCloserIds: string[];
    dayStart: Date;
    dayEnd: Date;
  }): Promise<CalendarAvailabilityScheduledLead[]> {
    return prisma.lead.findMany({
      where: {
        teamId: params.teamId,
        closerId: { in: params.requestedCloserIds },
        status: "scheduled",
        meetingDate: {
          gte: params.dayStart,
          lt: params.dayEnd,
        },
      },
      select: {
        meetingDate: true,
        closerId: true,
      },
    });
  }
}

export const calendarAvailabilityRepository = new CalendarAvailabilityRepository();
