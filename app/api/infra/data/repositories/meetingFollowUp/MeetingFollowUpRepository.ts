import { prisma } from "@/app/api/infra/data/prisma";
import { DEFAULT_TZ, formatIntimezone } from "@/lib/dates";
import {
  MEETING_FOLLOW_UP_EMAIL_MAX_PER_DAY,
  MEETING_FOLLOW_UP_EMAIL_MIN_INTERVAL_HOURS,
} from "@/lib/lead-meeting";

export type MeetingFollowUpLeadRow = {
  id: string;
  name: string;
  leadCode: string;
  teamId: string;
  closerId: string | null;
  managerId: string;
  meetingDate: Date | null;
};

export type TeamMasterRow = {
  id: string;
  masterId: string;
  name: string;
};

export type RecipientProfileRow = {
  id: string;
  email: string;
  fullName: string | null;
  supabaseId: string | null;
};

export class MeetingFollowUpRepository {
  async findLeadsRequiringFollowUp(thresholdDate: Date): Promise<MeetingFollowUpLeadRow[]> {
    const leads = await prisma.lead.findMany({
      where: {
        status: "scheduled",
        meetingDate: { not: null, lt: thresholdDate },
        teamId: { not: null },
        OR: [{ meetingHeald: null }, { meetingHeald: "no" }],
      },
      select: {
        id: true,
        name: true,
        leadCode: true,
        teamId: true,
        closerId: true,
        managerId: true,
        meetingDate: true,
      },
    });

    return leads
      .filter((lead): lead is typeof lead & { teamId: string } => lead.teamId !== null)
      .map((lead) => ({
        id: lead.id,
        name: lead.name,
        leadCode: lead.leadCode,
        teamId: lead.teamId,
        closerId: lead.closerId,
        managerId: lead.managerId,
        meetingDate: lead.meetingDate,
      }));
  }

  async findTeamsMasterIds(teamIds: string[]): Promise<TeamMasterRow[]> {
    if (teamIds.length === 0) return [];

    return prisma.team.findMany({
      where: { id: { in: teamIds } },
      select: { id: true, masterId: true, name: true },
    });
  }

  async findRecipientProfiles(profileIds: string[]): Promise<RecipientProfileRow[]> {
    if (profileIds.length === 0) return [];

    return prisma.profile.findMany({
      where: { id: { in: profileIds } },
      select: { id: true, email: true, fullName: true, supabaseId: true },
    });
  }

  getDigestDateKey(now: Date): string {
    return formatIntimezone(now, "yyyy-MM-dd", DEFAULT_TZ);
  }

  async countDigestEmailsToday(
    recipientProfileId: string,
    teamId: string,
    digestDate: string,
  ): Promise<number> {
    const digestDateValue = new Date(`${digestDate}T00:00:00.000Z`);

    return prisma.meetingFollowUpDigestLog.count({
      where: {
        recipientProfileId,
        teamId,
        digestDate: digestDateValue,
        channel: "email",
      },
    });
  }

  async findLastDigestSentAt(
    recipientProfileId: string,
    teamId: string,
    digestDate: string,
  ): Promise<Date | null> {
    const digestDateValue = new Date(`${digestDate}T00:00:00.000Z`);

    const lastLog = await prisma.meetingFollowUpDigestLog.findFirst({
      where: {
        recipientProfileId,
        teamId,
        digestDate: digestDateValue,
        channel: "email",
      },
      orderBy: { sentAt: "desc" },
      select: { sentAt: true },
    });

    return lastLog?.sentAt ?? null;
  }

  async canSendDigestEmail(
    recipientProfileId: string,
    teamId: string,
    now: Date,
  ): Promise<boolean> {
    const digestDate = this.getDigestDateKey(now);
    const emailCount = await this.countDigestEmailsToday(recipientProfileId, teamId, digestDate);

    if (emailCount >= MEETING_FOLLOW_UP_EMAIL_MAX_PER_DAY) {
      return false;
    }

    if (emailCount === 0) {
      return true;
    }

    const lastSentAt = await this.findLastDigestSentAt(recipientProfileId, teamId, digestDate);
    if (!lastSentAt) {
      return true;
    }

    const minIntervalMs = MEETING_FOLLOW_UP_EMAIL_MIN_INTERVAL_HOURS * 60 * 60 * 1000;
    return now.getTime() - lastSentAt.getTime() >= minIntervalMs;
  }

  async createDigestLog(input: {
    recipientProfileId: string;
    teamId: string;
    digestDate: string;
    leadCount: number;
    sentAt: Date;
    channel: "email" | "in_app";
  }) {
    const digestDateValue = new Date(`${input.digestDate}T00:00:00.000Z`);

    await prisma.meetingFollowUpDigestLog.create({
      data: {
        recipientProfileId: input.recipientProfileId,
        teamId: input.teamId,
        digestDate: digestDateValue,
        leadCount: input.leadCount,
        sentAt: input.sentAt,
        channel: input.channel,
      },
    });
  }
}

export const meetingFollowUpRepository = new MeetingFollowUpRepository();
