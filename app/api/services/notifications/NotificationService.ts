import { NotificationType } from "@prisma/client";
import { prisma } from "@/app/api/infra/data/prisma";

type MentionNotificationInput = {
  teamId: string;
  actorProfileId: string;
  actorName: string;
  leadId: string;
  leadCode: string | null;
  leadName: string;
  activityId: string;
  body: string;
  recipientProfileIds: string[];
};

type TeamMembershipNotificationInput = {
  teamId: string;
  actorProfileId: string;
  actorName: string;
  teamName: string;
  recipientProfileId: string;
  type: "TEAM_MEMBER_ADDED" | "TEAM_MEMBER_REMOVED";
};

type ScheduleNotificationInput = {
  teamId: string;
  actorProfileId: string;
  actorName: string;
  leadId: string;
  leadCode: string | null;
  leadName: string;
  meetingDate: Date;
  recipientProfileIds: string[];
  isReschedule: boolean;
};

type ListNotificationsInput = {
  recipientProfileId: string;
  teamId: string;
  limit: number;
  offset: number;
};

type CountUnreadInput = {
  recipientProfileId: string;
  teamId: string;
};

class NotificationService {
  async createMentionNotifications(input: MentionNotificationInput) {
    const uniqueRecipients = Array.from(
      new Set(
        input.recipientProfileIds.filter(
          (profileId) => profileId && profileId !== input.actorProfileId
        )
      )
    );

    if (uniqueRecipients.length === 0) {
      return { createdCount: 0 };
    }

    const preview = input.body.trim().slice(0, 120);
    const message = `${input.actorName} marcou você em uma atividade do lead ${input.leadName}.`;

    const result = await prisma.notification.createMany({
      data: uniqueRecipients.map((recipientProfileId) => ({
        recipientProfileId,
        actorProfileId: input.actorProfileId,
        teamId: input.teamId,
        type: NotificationType.ACTIVITY_MENTION,
        message,
        metadata: {
          leadId: input.leadId,
          leadCode: input.leadCode,
          leadName: input.leadName,
          activityId: input.activityId,
          preview,
        },
      })),
      skipDuplicates: false,
    });

    return { createdCount: result.count };
  }

  async createTeamMembershipNotification(input: TeamMembershipNotificationInput) {
    if (!input.recipientProfileId || input.recipientProfileId === input.actorProfileId) {
      return null;
    }

    const message =
      input.type === NotificationType.TEAM_MEMBER_ADDED
        ? `${input.actorName} adicionou você ao time ${input.teamName}.`
        : `${input.actorName} removeu você do time ${input.teamName}.`;

    return prisma.notification.create({
      data: {
        recipientProfileId: input.recipientProfileId,
        actorProfileId: input.actorProfileId,
        teamId: input.teamId,
        type: input.type,
        message,
        metadata: {
          teamId: input.teamId,
          teamName: input.teamName,
        },
      },
    });
  }

  async createScheduleNotification(input: ScheduleNotificationInput) {
    const uniqueRecipients = Array.from(
      new Set(
        input.recipientProfileIds.filter(
          (profileId) => profileId && profileId !== input.actorProfileId
        )
      )
    );

    if (uniqueRecipients.length === 0) {
      return { createdCount: 0 };
    }

    const actionLabel = input.isReschedule ? "reagendou" : "criou";
    const message = `${input.actorName} ${actionLabel} um agendamento para o lead ${input.leadName}.`;

    const result = await prisma.notification.createMany({
      data: uniqueRecipients.map((recipientProfileId) => ({
        recipientProfileId,
        actorProfileId: input.actorProfileId,
        teamId: input.teamId,
        type: NotificationType.LEAD_SCHEDULE_CREATED,
        message,
        metadata: {
          leadId: input.leadId,
          leadCode: input.leadCode,
          leadName: input.leadName,
          meetingDate: input.meetingDate.toISOString(),
          isReschedule: input.isReschedule,
        },
      })),
      skipDuplicates: false,
    });

    return { createdCount: result.count };
  }

  async listByRecipientAndTeam(input: ListNotificationsInput) {
    const [notifications, total] = await prisma.$transaction([
      prisma.notification.findMany({
        where: {
          recipientProfileId: input.recipientProfileId,
          teamId: input.teamId,
        },
        include: {
          actor: {
            select: {
              id: true,
              fullName: true,
              email: true,
              profileIconUrl: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: input.limit,
        skip: input.offset,
      }),
      prisma.notification.count({
        where: {
          recipientProfileId: input.recipientProfileId,
          teamId: input.teamId,
        },
      }),
    ]);

    return { notifications, total };
  }

  async countUnreadByRecipientAndTeam(input: CountUnreadInput) {
    return prisma.notification.count({
      where: {
        recipientProfileId: input.recipientProfileId,
        teamId: input.teamId,
        isRead: false,
      },
    });
  }

  async markAllAsReadByRecipientAndTeam(input: CountUnreadInput) {
    const result = await prisma.notification.updateMany({
      where: {
        recipientProfileId: input.recipientProfileId,
        teamId: input.teamId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return result.count;
  }
}

export const notificationService = new NotificationService();
