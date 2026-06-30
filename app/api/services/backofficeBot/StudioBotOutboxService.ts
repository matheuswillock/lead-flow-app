import { getFullUrl } from "@/lib/utils/app-url";
import { backofficeBotRepository } from "@/app/api/infra/data/repositories/backofficeBot/BackofficeBotRepository";
import { backofficeBotEventOutboxUseCase } from "@/app/api/useCases/backofficeBot/BackofficeBotEventOutboxUseCase";
import type { StudioBotEventOutboxPayload } from "@/lib/studio-bot/types";
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
  async enqueuePushEvent(input: EnqueueInput): Promise<void> {
    try {
      const link = await backofficeBotRepository.findActiveUserLinkByProfile(input.profileId);
      if (!link?.normalizedPhone) {
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

      const payload: StudioBotEventOutboxPayload = {
        eventType: input.eventType,
        profileId: input.profileId,
        normalizedPhone: link.normalizedPhone,
        leadId: input.leadId,
        leadCode: input.leadCode ?? undefined,
        leadName: input.leadName,
        message: input.message,
        actionButtons: input.actionButtons ?? [],
        deepLink: input.deepLinkPath ? getFullUrl(input.deepLinkPath) : getFullUrl("/"),
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
}

export const studioBotOutboxService = new StudioBotOutboxService();
