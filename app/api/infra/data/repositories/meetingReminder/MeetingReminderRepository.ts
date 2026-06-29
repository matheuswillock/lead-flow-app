import { prisma } from "@/app/api/infra/data/prisma";

export type DueMeetingScheduleRow = {
  id: string;
  date: Date;
  meetingLink: string | null;
  lead: {
    id: string;
    leadCode: string;
    name: string;
    teamId: string | null;
    managerId: string;
    assignedTo: string | null;
    closerId: string | null;
  };
};

export class MeetingReminderRepository {
  async findSchedulesDueForReminder(windowStart: Date, windowEnd: Date) {
    return prisma.leadsSchedule.findMany({
      where: {
        reminder30MinSentAt: null,
        date: {
          gte: windowStart,
          lte: windowEnd,
        },
      },
      select: {
        id: true,
        date: true,
        meetingLink: true,
        lead: {
          select: {
            id: true,
            leadCode: true,
            name: true,
            teamId: true,
            managerId: true,
            assignedTo: true,
            closerId: true,
          },
        },
      },
    });
  }

  async findTeamMemberProfileIds(teamId: string, profileIds: string[]) {
    if (profileIds.length === 0) return [];

    const members = await prisma.teamMember.findMany({
      where: {
        teamId,
        profileId: { in: profileIds },
      },
      select: { profileId: true },
    });

    return members.map((member) => member.profileId);
  }

  async markReminderSent(scheduleId: string, sentAt: Date) {
    await prisma.leadsSchedule.update({
      where: { id: scheduleId },
      data: { reminder30MinSentAt: sentAt },
    });
  }
}

export const meetingReminderRepository = new MeetingReminderRepository();
