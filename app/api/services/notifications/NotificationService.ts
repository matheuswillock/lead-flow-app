import { NotificationType, type Prisma } from "@prisma/client";
import { prisma } from "@/app/api/infra/data/prisma";
import type { NotificationLinkMetadata } from "@/lib/notifications/build-notification-url";
import { dispatchWebPushToProfile } from "@/app/api/infra/webPush/dispatchWebPush";

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
  leadCode: string;
  leadName: string;
  sdrName?: string | null;
  scheduleShareUrl?: string | null;
};

type LeadTransferScheduleFailedNotificationInput = {
  teamId: string;
  recipientProfileId: string;
  leadId: string;
  leadCode: string | null;
  leadName: string;
  errorMessage: string;
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

type MeetingReminderNotificationInput = {
  teamId: string;
  leadId: string;
  leadCode: string | null;
  leadName: string;
  meetingDate: Date;
  meetingLink?: string | null;
  recipientProfileIds: string[];
};

type MeetingFollowUpDigestNotificationInput = {
  teamId: string;
  recipientProfileId: string;
  leadCount: number;
  role: "closer" | "master";
};

type WebPushDispatchItem = {
  recipientProfileId: string;
  teamId: string;
  type: NotificationType;
  message: string;
  metadata?: NotificationLinkMetadata | null;
  notificationId?: string;
};

class NotificationService {
  private dispatchWebPushForItems(items: WebPushDispatchItem[]) {
    for (const item of items) {
      void dispatchWebPushToProfile({
          profileId: item.recipientProfileId,
          teamId: item.teamId,
          type: item.type,
          message: item.message,
          metadata: item.metadata,
          notificationId: item.notificationId,
        })
        .catch((error) => {
          console.error("[NotificationService] Erro ao disparar web push:", error);
        });
    }
  }

  private metadataAsLinkMetadata(metadata: Prisma.InputJsonValue | undefined): NotificationLinkMetadata | null {
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
      return null;
    }
    return metadata as NotificationLinkMetadata;
  }
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

    this.dispatchWebPushForItems(
      uniqueRecipients.map((recipientProfileId) => ({
        recipientProfileId,
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
    );

    return { createdCount: result.count };
  }

  async createTaskCompletedNotification(input: TaskCompletedNotificationInput) {
    if (!input.recipientProfileId || input.recipientProfileId === input.actorProfileId) {
      return null;
    }

    const created = await prisma.notification.create({
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

    this.dispatchWebPushForItems([
      {
        recipientProfileId: input.recipientProfileId,
        teamId: input.teamId,
        type: NotificationType.ACTIVITY_MENTION,
        message: created.message,
        metadata: this.metadataAsLinkMetadata(created.metadata ?? undefined),
        notificationId: created.id,
      },
    ]);

    return created;
  }

  async createSystemNotification(input: SystemNotificationInput) {
    const created = await prisma.notification.create({
      data: {
        recipientProfileId: input.recipientProfileId,
        actorProfileId: null,
        teamId: input.teamId,
        type: input.type ?? NotificationType.TEAM_MEMBER_ADDED,
        message: input.message,
        metadata: input.metadata,
      },
    });

    this.dispatchWebPushForItems([
      {
        recipientProfileId: input.recipientProfileId,
        teamId: input.teamId,
        type: created.type,
        message: created.message,
        metadata: this.metadataAsLinkMetadata(created.metadata ?? undefined),
        notificationId: created.id,
      },
    ]);

    return created;
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

    this.dispatchWebPushForItems(
      uniqueRecipients.map((recipientProfileId) => ({
        recipientProfileId,
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
    );

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

    const created = await prisma.notification.create({
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

    this.dispatchWebPushForItems([
      {
        recipientProfileId: input.recipientProfileId,
        teamId: input.teamId,
        type: created.type,
        message: created.message,
        metadata: this.metadataAsLinkMetadata(created.metadata ?? undefined),
        notificationId: created.id,
      },
    ]);

    return created;
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

    this.dispatchWebPushForItems(
      uniqueRecipients.map((recipientProfileId) => ({
        recipientProfileId,
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
    );

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
      const created = await prisma.notification.create({
        data: {
          recipientProfileId: input.recipientProfileId,
          actorProfileId: input.actorProfileId,
          teamId: input.teamId,
          type: "ACTIVITY_REACTION" as NotificationType,
          message,
          metadata,
        },
      });

      this.dispatchWebPushForItems([
        {
          recipientProfileId: input.recipientProfileId,
          teamId: input.teamId,
          type: NotificationType.ACTIVITY_REACTION,
          message: created.message,
          metadata,
          notificationId: created.id,
        },
      ]);

      return created;
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

      const created = inserted[0] ?? null;
      if (created) {
        this.dispatchWebPushForItems([
          {
            recipientProfileId: input.recipientProfileId,
            teamId: input.teamId,
            type: NotificationType.ACTIVITY_REACTION,
            message,
            metadata,
            notificationId: created.id,
          },
        ]);
      }

      return created;
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

    this.dispatchWebPushForItems(
      uniqueRecipients.map((recipientProfileId) => ({
        recipientProfileId,
        teamId: input.teamId,
        type: NotificationType.LEAD_PROPOSAL_PENDING,
        message,
        metadata: {
          leadId: input.leadId,
          leadCode: input.leadCode,
          leadName: input.leadName,
        },
      })),
    );

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

    const sdrName = input.sdrName?.trim() || "Não informado";
    const message = `Lead ${input.leadName} foi adicionado para transferência. SDR: ${sdrName}.`;

    const result = await prisma.notification.createMany({
      data: uniqueRecipients.map((recipientProfileId) => ({
        recipientProfileId,
        teamId: input.teamId,
        type: NotificationType.LEAD_TRANSFER_ACTIVATED,
        message,
        metadata: {
          leadId: input.leadId,
          leadCode: input.leadCode,
          leadName: input.leadName,
          sdrName,
          scheduleShareUrl: input.scheduleShareUrl ?? null,
        },
      })),
      skipDuplicates: false,
    });

    this.dispatchWebPushForItems(
      uniqueRecipients.map((recipientProfileId) => ({
        recipientProfileId,
        teamId: input.teamId,
        type: NotificationType.LEAD_TRANSFER_ACTIVATED,
        message,
        metadata: {
          leadId: input.leadId,
          leadCode: input.leadCode,
          leadName: input.leadName,
          sdrName,
          scheduleShareUrl: input.scheduleShareUrl ?? null,
        },
      })),
    );

    return { createdCount: result.count };
  }

  async createTransferScheduleFailedNotification(input: LeadTransferScheduleFailedNotificationInput) {
    const message = `Lead ${input.leadName} foi transferido, mas o agendamento falhou: ${input.errorMessage}`;

    const created = await prisma.notification.create({
      data: {
        recipientProfileId: input.recipientProfileId,
        actorProfileId: null,
        teamId: input.teamId,
        type: NotificationType.LEAD_TRANSFER_SCHEDULE_FAILED,
        message,
        metadata: {
          leadId: input.leadId,
          leadCode: input.leadCode,
          leadName: input.leadName,
          errorMessage: input.errorMessage,
        },
      },
    });

    this.dispatchWebPushForItems([
      {
        recipientProfileId: input.recipientProfileId,
        teamId: input.teamId,
        type: NotificationType.LEAD_TRANSFER_SCHEDULE_FAILED,
        message,
        metadata: {
          leadId: input.leadId,
          leadCode: input.leadCode,
          leadName: input.leadName,
          errorMessage: input.errorMessage,
        },
        notificationId: created.id,
      },
    ]);

    return created;
  }

  async createMeetingReminderNotification(input: MeetingReminderNotificationInput) {
    const uniqueRecipients = Array.from(
      new Set(input.recipientProfileIds.filter((profileId) => !!profileId)),
    );

    if (uniqueRecipients.length === 0) {
      return { createdCount: 0 };
    }

    const message = `Reunião com ${input.leadName} começa em 30 minutos.`;
    const metadata = {
      leadId: input.leadId,
      leadCode: input.leadCode,
      leadName: input.leadName,
      meetingDate: input.meetingDate.toISOString(),
      meetingLink: input.meetingLink ?? null,
    };

    const result = await prisma.notification.createMany({
      data: uniqueRecipients.map((recipientProfileId) => ({
        recipientProfileId,
        teamId: input.teamId,
        type: NotificationType.MEETING_REMINDER,
        message,
        metadata,
      })),
      skipDuplicates: false,
    });

    this.dispatchWebPushForItems(
      uniqueRecipients.map((recipientProfileId) => ({
        recipientProfileId,
        teamId: input.teamId,
        type: NotificationType.MEETING_REMINDER,
        message,
        metadata,
      })),
    );

    return { createdCount: result.count };
  }

  async createMeetingFollowUpDigestNotification(input: MeetingFollowUpDigestNotificationInput) {
    const message =
      input.role === "closer"
        ? `Você tem ${input.leadCount} reunião${input.leadCount === 1 ? "" : "ões"} aguardando confirmação. Marque como realizada ou no-show.`
        : `Seu time tem ${input.leadCount} reunião${input.leadCount === 1 ? "" : "ões"} aguardando confirmação há mais de 3 dias.`;

    const metadata = {
      leadCount: input.leadCount,
      role: input.role,
      filter: "meeting_follow_up",
    };

    const created = await prisma.notification.create({
      data: {
        recipientProfileId: input.recipientProfileId,
        teamId: input.teamId,
        type: NotificationType.MEETING_FOLLOW_UP_DIGEST,
        message,
        metadata,
      },
    });

    this.dispatchWebPushForItems([
      {
        recipientProfileId: input.recipientProfileId,
        teamId: input.teamId,
        type: NotificationType.MEETING_FOLLOW_UP_DIGEST,
        message,
        metadata,
        notificationId: created.id,
      },
    ]);

    return { createdCount: 1 };
  }
}

export const notificationService = new NotificationService();
