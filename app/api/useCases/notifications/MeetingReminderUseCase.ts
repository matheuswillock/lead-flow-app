import { Output } from "@/lib/output";
import { meetingReminderRepository } from "@/app/api/infra/data/repositories/meetingReminder/MeetingReminderRepository";
import { backofficeBotRepository } from "@/app/api/infra/data/repositories/backofficeBot/BackofficeBotRepository";
import { notificationService } from "@/app/api/services/notifications/NotificationService";
import { studioBotOutboxService } from "@/app/api/services/backofficeBot/StudioBotOutboxService";
import { outboundEventPublisher } from "@/app/api/services/teamWebhook/OutboundEventPublisher";

export class MeetingReminderUseCase {
  async processDueReminders(): Promise<Output> {
    try {
      const now = new Date();
      const windowStart = new Date(now.getTime() + 29 * 60 * 1000);
      const windowEnd = new Date(now.getTime() + 31 * 60 * 1000);

      const schedules = await meetingReminderRepository.findSchedulesDueForReminder(
        windowStart,
        windowEnd,
      );

      let processedCount = 0;

      for (const schedule of schedules) {
        const lead = schedule.lead;
        if (!lead?.teamId) continue;

        const candidateRecipientIds = [lead.closerId, lead.assignedTo, lead.managerId].filter(
          (profileId): profileId is string => !!profileId,
        );

        if (candidateRecipientIds.length === 0) continue;

        const recipientProfileIds = await meetingReminderRepository.findTeamMemberProfileIds(
          lead.teamId,
          candidateRecipientIds,
        );

        if (recipientProfileIds.length === 0) continue;

        await notificationService.createMeetingReminderNotification({
          teamId: lead.teamId,
          leadId: lead.id,
          leadCode: lead.leadCode ?? null,
          leadName: lead.name,
          meetingDate: schedule.date,
          meetingLink: schedule.meetingLink,
          recipientProfileIds,
        });

        void outboundEventPublisher.publish({
          teamId: lead.teamId,
          eventKey: "appointment_reminder",
          leadId: lead.id,
          payload: {
            lead: { id: lead.id, name: lead.name, leadCode: lead.leadCode },
            schedule: {
              id: schedule.id,
              meeting_date: schedule.date.toISOString(),
              meeting_link: schedule.meetingLink,
            },
          },
        });

        for (const profileId of recipientProfileIds) {
          await studioBotOutboxService.enqueueMeetingReminder({
            profileId,
            teamId: lead.teamId,
            leadId: lead.id,
            leadCode: lead.leadCode ?? null,
            leadName: lead.name,
            meetingDate: schedule.date,
            scheduleId: schedule.id,
          });
        }

        await meetingReminderRepository.markReminderSent(schedule.id, now);
        processedCount += 1;
      }

      const fiveMinResult = await this.process5MinReminders(now);

      return new Output(true, [], [], {
        processedCount,
        processed5MinCount: fiveMinResult.processedCount,
      });
    } catch (error) {
      console.error("[MeetingReminderUseCase][processDueReminders] Erro:", error);
      return new Output(false, [], ["Erro ao processar lembretes de reunião"], null);
    }
  }

  private async process5MinReminders(now: Date): Promise<{ processedCount: number }> {
    const windowStart = new Date(now.getTime() + 4 * 60 * 1000);
    const windowEnd = new Date(now.getTime() + 6 * 60 * 1000);

    const schedules = await meetingReminderRepository.findSchedulesDueFor5MinReminder(
      windowStart,
      windowEnd,
    );

    let processedCount = 0;

    for (const schedule of schedules) {
      const lead = schedule.lead;
      if (!lead?.teamId) continue;

      const candidateRecipientIds = [lead.closerId, lead.assignedTo, lead.managerId].filter(
        (profileId): profileId is string => !!profileId,
      );

      if (candidateRecipientIds.length === 0) continue;

      const recipientProfileIds = await meetingReminderRepository.findTeamMemberProfileIds(
        lead.teamId,
        candidateRecipientIds,
      );

      if (recipientProfileIds.length === 0) continue;

      for (const profileId of recipientProfileIds) {
        const idempotencyKey = `meeting-reminder-5m:${schedule.id}:${profileId}`;
        const existing = await backofficeBotRepository.findOutboxEventByIdempotencyKey(idempotencyKey);
        if (existing) continue;

        await studioBotOutboxService.enqueueMeetingReminder5m({
          profileId,
          leadId: lead.id,
          leadCode: lead.leadCode ?? null,
          leadName: lead.name,
          scheduleId: schedule.id,
          meetingLink: schedule.meetingLink,
        });
      }

      processedCount += 1;
    }

    return { processedCount };
  }
}

export const meetingReminderUseCase = new MeetingReminderUseCase();
