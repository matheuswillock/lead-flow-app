import { getFullUrl } from "@/lib/utils/app-url";
import { backofficeBotRepository } from "@/app/api/infra/data/repositories/backofficeBot/BackofficeBotRepository";
import { backofficeBotEventOutboxUseCase } from "@/app/api/useCases/backofficeBot/BackofficeBotEventOutboxUseCase";
import type { StudioBotEventOutboxPayload } from "@/lib/studio-bot/types";
import { isOutsideWhatsAppWindow } from "@/lib/studio-bot/hsm";
import { mapEventTypeToPreferenceType } from "@/lib/studio-bot/notification-preference";
import { isWithinQuietHours } from "@/lib/studio-bot/quiet-hours";
import { isWithinPushRateLimit } from "@/lib/studio-bot/push-rate-limit";

type EnqueueInput = {
  eventType: string;
  profileId: string;
  message: string;
  leadId?: string;
  leadCode?: string | null;
  leadName?: string;
  actionButtons?: StudioBotEventOutboxPayload["actionButtons"];
  deepLinkPath?: string;
  idempotencyKey: string;
};

export class StudioBotOutboxService {
  private async shouldEnqueuePush(profileId: string, eventType: string): Promise<boolean> {
    const preferenceType = mapEventTypeToPreferenceType(eventType);
    const preference = await backofficeBotRepository.findNotificationPreference(
      profileId,
      preferenceType
    );

    if (preference && !preference.enabled) {
      return false;
    }

    if (preference?.quietHours && isWithinQuietHours(preference.quietHours)) {
      console.info("[StudioBotOutboxService] Quiet hours ativos para profile", profileId);
      return false;
    }

    return true;
  }

  async enqueuePushEvent(input: EnqueueInput): Promise<void> {
    try {
      if (!(await this.shouldEnqueuePush(input.profileId, input.eventType))) {
        return;
      }

      const normalizedPhone = await backofficeBotRepository.resolvePushPhoneForProfile(
        input.profileId
      );
      if (!normalizedPhone) {
        return;
      }

      const since = new Date(Date.now() - 60 * 60 * 1000);
      const sentCount = await backofficeBotRepository.countSentOutboxEventsForProfileSince(
        input.profileId,
        since
      );

      if (!isWithinPushRateLimit(sentCount)) {
        console.info("[StudioBotOutboxService] Rate limit atingido para profile", input.profileId);
        return;
      }

      const lastInboundAt = await backofficeBotRepository.findLastInboundAtByPhone(normalizedPhone);
      const requiresHsm = isOutsideWhatsAppWindow(lastInboundAt);

      const payload: StudioBotEventOutboxPayload = {
        eventType: input.eventType,
        profileId: input.profileId,
        normalizedPhone,
        leadId: input.leadId,
        leadCode: input.leadCode ?? undefined,
        leadName: input.leadName,
        message: input.message,
        actionButtons: input.actionButtons ?? [],
        deepLink: input.deepLinkPath ? getFullUrl(input.deepLinkPath) : getFullUrl("/"),
        requiresHsm,
        lastInboundAt: lastInboundAt?.toISOString() ?? null,
      };

      await backofficeBotEventOutboxUseCase.enqueueEvent(payload, input.idempotencyKey);
    } catch (error) {
      console.error("[StudioBotOutboxService][enqueuePushEvent]", error);
    }
  }

  async enqueueMeetingReminder(input: {
    profileId: string;
    teamId: string;
    leadId: string;
    leadCode: string | null;
    leadName: string;
    meetingDate: Date;
    scheduleId: string;
  }): Promise<void> {
    await this.enqueuePushEvent({
      eventType: "meeting.reminder_30m",
      profileId: input.profileId,
      leadId: input.leadId,
      leadCode: input.leadCode,
      leadName: input.leadName,
      message: `Reunião com ${input.leadName} começa em 30 minutos.`,
      deepLinkPath: `/leads/${input.leadId}`,
      idempotencyKey: `meeting-reminder-30m:${input.scheduleId}:${input.profileId}`,
      actionButtons: [
        { id: "view_lead", label: "Ver lead", payload: { action: "lead_detail", leadId: input.leadId } },
        { id: "reschedule", label: "Remarcar", payload: { action: "schedule_meeting", leadId: input.leadId } },
      ],
    });
  }

  async enqueueMeetingReminder5m(input: {
    profileId: string;
    leadId: string;
    leadCode: string | null;
    leadName: string;
    scheduleId: string;
    meetingLink?: string | null;
  }): Promise<void> {
    await this.enqueuePushEvent({
      eventType: "meeting.reminder_5m",
      profileId: input.profileId,
      leadId: input.leadId,
      leadCode: input.leadCode,
      leadName: input.leadName,
      message: `Reunião com ${input.leadName} começa em 5 minutos.`,
      deepLinkPath: `/leads/${input.leadId}`,
      idempotencyKey: `meeting-reminder-5m:${input.scheduleId}:${input.profileId}`,
      actionButtons: [
        { id: "view_lead", label: "Ver lead", payload: { action: "lead_detail", leadId: input.leadId } },
        ...(input.meetingLink
          ? [{ id: "open_link", label: "Abrir link", payload: { action: "open_url", url: input.meetingLink } }]
          : []),
      ],
    });
  }

  async enqueueTaskDue(input: {
    profileId: string;
    leadId: string;
    leadName: string;
    taskId: string;
    title: string;
  }): Promise<void> {
    await this.enqueuePushEvent({
      eventType: "task.due_today",
      profileId: input.profileId,
      leadId: input.leadId,
      leadName: input.leadName,
      message: `Tarefa vence hoje: ${input.title}`,
      deepLinkPath: `/leads/${input.leadId}`,
      idempotencyKey: `task-due:${input.taskId}:${input.profileId}`,
      actionButtons: [
        { id: "view_task", label: "Ver tarefa", payload: { action: "list_tasks", leadId: input.leadId } },
      ],
    });
  }

  async enqueueTaskOverdue(input: {
    profileId: string;
    leadId: string;
    leadName: string;
    taskId: string;
    title: string;
  }): Promise<void> {
    await this.enqueuePushEvent({
      eventType: "task.overdue",
      profileId: input.profileId,
      leadId: input.leadId,
      leadName: input.leadName,
      message: `Tarefa em atraso: ${input.title}`,
      deepLinkPath: `/leads/${input.leadId}`,
      idempotencyKey: `task-overdue:${input.taskId}:${input.profileId}`,
      actionButtons: [
        { id: "view_task", label: "Ver tarefa", payload: { action: "list_tasks", leadId: input.leadId } },
      ],
    });
  }

  async enqueueLeadAssigned(input: {
    profileId: string;
    leadId: string;
    leadCode: string | null;
    leadName: string;
  }): Promise<void> {
    await this.enqueuePushEvent({
      eventType: "lead.assigned",
      profileId: input.profileId,
      leadId: input.leadId,
      leadCode: input.leadCode,
      leadName: input.leadName,
      message: `Novo lead atribuído: ${input.leadName}`,
      deepLinkPath: `/leads/${input.leadId}`,
      idempotencyKey: `lead-assigned:${input.leadId}:${input.profileId}`,
      actionButtons: [
        { id: "view_lead", label: "Ver lead", payload: { action: "lead_detail", leadId: input.leadId } },
        { id: "menu", label: "Menu", payload: { action: "menu" } },
      ],
    });
  }

  async enqueueLeadStatusChanged(input: {
    profileId: string;
    leadId: string;
    leadCode: string | null;
    leadName: string;
    statusLabel: string;
    batchBucket: number;
  }): Promise<void> {
    await this.enqueuePushEvent({
      eventType: "lead.status_changed",
      profileId: input.profileId,
      leadId: input.leadId,
      leadCode: input.leadCode,
      leadName: input.leadName,
      message: `Lead ${input.leadName} mudou para ${input.statusLabel}.`,
      deepLinkPath: `/leads/${input.leadId}`,
      idempotencyKey: `lead-status:${input.leadId}:${input.profileId}:${input.batchBucket}`,
      actionButtons: [
        { id: "view_lead", label: "Ver lead", payload: { action: "lead_detail", leadId: input.leadId } },
      ],
    });
  }
}

export const studioBotOutboxService = new StudioBotOutboxService();
