import { prisma } from "../../prisma";
import { isGoogleConnectionActive } from "@/lib/google/connection";
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
    const profiles = await prisma.profile.findMany({
      where: { id: { in: requestedCloserIds } },
      select: {
        id: true,
        email: true,
        timezone: true,
        googleConnection: {
          select: {
            id: true,
            googleEmail: true,
            accessToken: true,
            refreshToken: true,
            tokenExpiresAt: true,
            scopes: true,
            ownerProfileId: true,
            revokedAt: true,
            lastRefreshedAt: true,
            lastRefreshError: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        supabaseId: true,
      },
    });

    return profiles.map((profile) => ({
      id: profile.id,
      email: profile.email,
      timezone: profile.timezone,
      googleCalendarConnected: isGoogleConnectionActive(profile.googleConnection),
      googleRefreshToken: profile.googleConnection?.refreshToken ?? null,
      googleAccessToken: profile.googleConnection?.accessToken ?? null,
      googleTokenExpiresAt: profile.googleConnection?.tokenExpiresAt ?? null,
      googleConnection: profile.googleConnection,
      supabaseId: profile.supabaseId,
    }));
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
