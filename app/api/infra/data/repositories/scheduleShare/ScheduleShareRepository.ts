import { prisma } from "../../prisma";
import type {
  IScheduleShareRepository,
  LeadForScheduleShare,
  PublicScheduleShareRecord,
  ScheduleForScheduleShare,
} from "./IScheduleShareRepository";

export class ScheduleShareRepository implements IScheduleShareRepository {
  async findLeadForShare(leadId: string): Promise<LeadForScheduleShare | null> {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        id: true,
        teamId: true,
        name: true,
        meetingDate: true,
        meetingTitle: true,
        meetingLink: true,
        meetingType: true,
        isTransfer: true,
        closer: {
          select: {
            timezone: true,
          },
        },
      },
    });

    if (!lead) return null;

    return {
      id: lead.id,
      teamId: lead.teamId,
      name: lead.name,
      meetingDate: lead.meetingDate,
      meetingTitle: lead.meetingTitle,
      meetingLink: lead.meetingLink,
      meetingType: lead.meetingType,
      closerTimezone: lead.closer?.timezone ?? null,
      isTransfer: lead.isTransfer === true,
    };
  }

  async findScheduleByLeadId(leadId: string): Promise<ScheduleForScheduleShare | null> {
    return prisma.leadsSchedule.findUnique({
      where: { leadId },
      select: {
        id: true,
        date: true,
        meetingTitle: true,
        meetingLink: true,
        meetingType: true,
        publicShareTokenHash: true,
        publicShareExpiresAt: true,
      },
    });
  }

  async updateScheduleShare(id: string, data: {
    publicShareTokenHash: string;
    publicShareExpiresAt: Date;
  }): Promise<void> {
    await prisma.leadsSchedule.update({
      where: { id },
      data,
    });
  }

  async findPublicScheduleById(scheduleId: string): Promise<PublicScheduleShareRecord | null> {
    const schedule = await prisma.leadsSchedule.findUnique({
      where: { id: scheduleId },
      select: {
        id: true,
        date: true,
        meetingTitle: true,
        meetingLink: true,
        meetingType: true,
        publicShareTokenHash: true,
        publicShareExpiresAt: true,
        lead: {
          select: {
            name: true,
            meetingDate: true,
            meetingTitle: true,
            meetingLink: true,
            meetingType: true,
            isTransfer: true,
            closer: {
              select: {
                timezone: true,
              },
            },
          },
        },
      },
    });

    if (!schedule) return null;

    return {
      id: schedule.id,
      date: schedule.date,
      meetingTitle: schedule.meetingTitle,
      meetingLink: schedule.meetingLink,
      meetingType: schedule.meetingType,
      publicShareTokenHash: schedule.publicShareTokenHash,
      publicShareExpiresAt: schedule.publicShareExpiresAt,
      leadName: schedule.lead.name,
      leadMeetingDate: schedule.lead.meetingDate,
      leadMeetingTitle: schedule.lead.meetingTitle,
      leadMeetingLink: schedule.lead.meetingLink,
      leadMeetingType: schedule.lead.meetingType,
      closerTimezone: schedule.lead.closer?.timezone ?? null,
      leadIsTransfer: schedule.lead.isTransfer === true,
    };
  }
}

export const scheduleShareRepository = new ScheduleShareRepository();
