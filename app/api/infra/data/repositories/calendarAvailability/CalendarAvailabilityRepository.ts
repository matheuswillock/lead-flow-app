import { prisma } from "../../prisma";
import { MEETING_OCCUPANCY_LEAD_WHERE } from "@/app/api/domain/leadSchedule/meetingOccupancy";
import { isGoogleConnectionActive } from "@/lib/google/connection";
import type {
  CalendarAvailabilityCloserProfile,
  CalendarAvailabilityExcludedLead,
  CalendarAvailabilityReservation,
  CalendarAvailabilityScheduledLead,
  ICalendarAvailabilityRepository,
} from "./ICalendarAvailabilityRepository";

export class CalendarAvailabilityRepository implements ICalendarAvailabilityRepository {
  async findMeetingDuration(teamId: string): Promise<number | null> {
    const team = await prisma.team.findFirst({
      where: { id: teamId, deletedAt: null },
      select: { meetingDurationMinutes: true },
    });
    return team?.meetingDurationMinutes ?? null;
  }

  async findTeamMemberProfileIds(teamId: string, requestedCloserIds: string[]): Promise<string[]> {
    const teamMembers = await prisma.teamMember.findMany({
      where: {
        teamId,
        profileId: { in: requestedCloserIds },
        functions: { has: "CLOSER" },
        team: { deletedAt: null },
        profile: { deletedAt: null },
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
    // Ocupação é do closer, em qualquer time (SPEC 13/14): sem filtro de `teamId`.
    return prisma.lead.findMany({
      where: {
        ...MEETING_OCCUPANCY_LEAD_WHERE,
        closerId: { in: params.requestedCloserIds },
        meetingDate: {
          gte: params.dayStart,
          lt: params.dayEnd,
        },
      },
      select: {
        meetingDate: true,
        closerId: true,
        meetingDurationMinutes: true,
      },
    });
  }

  async findActiveReservations(params: {
    teamId: string;
    requestedCloserIds: string[];
    rangeStart: Date;
    rangeEnd: Date;
    excludeLeadId?: string;
  }): Promise<CalendarAvailabilityReservation[]> {
    return prisma.teamMeetingSlotReservation.findMany({
      where: {
        closerId: { in: params.requestedCloserIds },
        state: { in: ["reserved", "consumed"] },
        startsAt: { lt: params.rangeEnd },
        endsAt: { gt: params.rangeStart },
        ...(params.excludeLeadId ? { NOT: { leadId: params.excludeLeadId } } : {}),
      },
      select: { closerId: true, startsAt: true, endsAt: true },
    });
  }
}

export const calendarAvailabilityRepository = new CalendarAvailabilityRepository();
