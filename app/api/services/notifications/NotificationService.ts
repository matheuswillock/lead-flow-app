import { NotificationType, type Prisma } from "@prisma/client";
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

type ActivityReactionNotificationInput = {
  teamId: string;
  actorProfileId: string;
  actorName: string;
  recipientProfileId: string;
  leadId: string;
  leadCode: string | null;
  leadName: string;
  activityId: string;
  emoji: string;
};

type LeadProposalPendingNotificationInput = {
  teamId: string;
  actorProfileId: string;
  actorName: string;
  recipientProfileIds: string[];
  leadId: string;
  leadCode: string | null;
  leadName: string;
  leadEmail?: string | null;
  leadPhone?: string | null;
  sdrName?: string | null;
  closerName?: string | null;
  notes?: string | null;
  previousStatus: string;
  nextStatus: string;
};

type LeadTransferActivatedNotificationInput = {
  teamId: string;
  recipientProfileIds: string[];
  leadId: string;
  leadName: string;
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

type TaskAssignmentNotificationInput = {
  teamId: string;
  actorProfileId: string;
  actorName: string;
  leadId: string;
  leadCode: string | null;
  leadName: string;
  taskId: string;
  body: string;
  recipientProfileIds: string[];
};

type TaskCompletedNotificationInput = {
  teamId: string;
  actorProfileId: string;
  actorName: string;
  recipientProfileId: string;
  leadId: string;
  leadCode: string | null;
  leadName: string;
  taskId: string;
  taskTitle: string;
};

type SystemNotificationInput = {
  recipientProfileId: string;
  teamId: string;
  message: string;
  type?: NotificationType;
  metadata?: Prisma.InputJsonValue;
};

class NotificationService {
  async createTaskAssignmentNotifications(input: TaskAssignmentNotificationInput) {
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

    const profiles = await prisma.profile.findMany({
      where: { id: { in: uniqueRecipients } },
      select: { id: true, fullName: true, email: true },
    });
    const profileMap = new Map(
      profiles.map((profile) => [profile.id, profile.fullName?.trim() || profile.email])
    );
    const preview = input.body.trim().slice(0, 120);

    const result = await prisma.notification.createMany({
      data: uniqueRecipients.map((recipientProfileId) => ({
        recipientProfileId,
        actorProfileId: input.actorProfileId,
        teamId: input.teamId,
        type: NotificationType.ACTIVITY_MENTION,
        message: `${input.actorName} atribuiu uma tarefa para @${profileMap.get(recipientProfileId) || "usuário"} no lead ${input.leadName}.`,
        metadata: {
          event: "TASK_ASSIGNED",
          leadId: input.leadId,
          leadCode: input.leadCode,
          leadName: input.leadName,
          taskId: input.taskId,
          preview,
        },
      })),
      skipDuplicates: false,
    });

    return { createdCount: result.count };
  }

  async createTaskCompletedNotification(input: TaskCompletedNotificationInput) {
    if (!input.recipientProfileId || input.recipientProfileId === input.actorProfileId) {
      return null;
    }

    return prisma.notification.create({
      data: {
        recipientProfileId: input.recipientProfileId,
        actorProfileId: input.actorProfileId,
        teamId: input.teamId,
        type: NotificationType.ACTIVITY_MENTION,
        message: `${input.actorName} concluiu a task "${input.taskTitle}" no lead ${input.leadName}.`,
        metadata: {
          event: "TASK_COMPLETED",
          leadId: input.leadId,
          leadCode: input.leadCode,
          leadName: input.leadName,
          taskId: input.taskId,
          preview: input.taskTitle,
        },
      },
    });
  }

  async createSystemNotification(input: SystemNotificationInput) {
    return prisma.notification.create({
      data: {
        recipientProfileId: input.recipientProfileId,
        actorProfileId: null,
        teamId: input.teamId,
        type: input.type ?? NotificationType.TEAM_MEMBER_ADDED,
        message: input.message,
        metadata: input.metadata,
      },
    });
  }

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

  async createActivityReactionNotification(input: ActivityReactionNotificationInput) {
    if (!input.recipientProfileId || input.recipientProfileId === input.actorProfileId) {
      return null;
    }

    const message = `${input.actorName} reagiu ${input.emoji} à sua atividade no lead ${input.leadName}.`;
    const metadata = {
      leadId: input.leadId,
      leadCode: input.leadCode,
      leadName: input.leadName,
      activityId: input.activityId,
      emoji: input.emoji,
    };

    try {
      return await prisma.notification.create({
        data: {
          recipientProfileId: input.recipientProfileId,
          actorProfileId: input.actorProfileId,
          teamId: input.teamId,
          type: "ACTIVITY_REACTION" as NotificationType,
          message,
          metadata,
        },
      });
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "";
      const isEnumValidationError =
        messageText.includes("Invalid value for argument `type`")
        || messageText.includes("Expected NotificationType");

      if (!isEnumValidationError) {
        throw error;
      }

      const inserted = await prisma.$queryRaw<Array<{ id: string }>>`
        INSERT INTO "corretor_studio_notifications" (
          "recipientProfileId",
          "actorProfileId",
          "teamId",
          "type",
          "message",
          "metadata"
        )
        VALUES (
          ${input.recipientProfileId}::uuid,
          ${input.actorProfileId}::uuid,
          ${input.teamId}::uuid,
          'ACTIVITY_REACTION'::"notification_type",
          ${message},
          ${JSON.stringify(metadata)}::jsonb
        )
        RETURNING "id";
      `;

      return inserted[0] ?? null;
    }
  }

  async createLeadProposalPendingNotification(input: LeadProposalPendingNotificationInput) {
    const uniqueRecipients = Array.from(
      new Set(input.recipientProfileIds.filter((profileId) => !!profileId))
    );

    if (uniqueRecipients.length === 0) {
      return { createdCount: 0 };
    }

    const message = `${input.actorName} moveu o lead ${input.leadName} para proposta pendente.`;

    const result = await prisma.notification.createMany({
      data: uniqueRecipients.map((recipientProfileId) => ({
        recipientProfileId,
        actorProfileId: input.actorProfileId,
        teamId: input.teamId,
        type: NotificationType.LEAD_PROPOSAL_PENDING,
        message,
        metadata: {
          leadId: input.leadId,
          leadCode: input.leadCode,
          leadName: input.leadName,
          leadEmail: input.leadEmail,
          leadPhone: input.leadPhone,
          sdrName: input.sdrName,
          closerName: input.closerName,
          notes: input.notes,
          previousStatus: input.previousStatus,
          nextStatus: input.nextStatus,
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

  async createLeadTransferActivatedNotification(input: LeadTransferActivatedNotificationInput) {
    const uniqueRecipients = Array.from(
      new Set(input.recipientProfileIds.filter((id) => !!id))
    );

    if (uniqueRecipients.length === 0) {
      return { createdCount: 0 };
    }

    const message = `Lead ${input.leadName} foi adicionado para transferência.`;

    const result = await prisma.notification.createMany({
      data: uniqueRecipients.map((recipientProfileId) => ({
        recipientProfileId,
        teamId: input.teamId,
        type: NotificationType.LEAD_TRANSFER_ACTIVATED,
        message,
        metadata: {
          leadId: input.leadId,
          leadName: input.leadName,
        },
      })),
      skipDuplicates: false,
    });

    return { createdCount: result.count };
  }
}

export const notificationService = new NotificationService();
