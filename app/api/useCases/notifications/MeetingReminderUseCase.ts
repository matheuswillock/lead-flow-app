import { Output } from "@/lib/output";
import { meetingReminderRepository } from "@/app/api/infra/data/repositories/meetingReminder/MeetingReminderRepository";
import { notificationService } from "@/app/api/services/notifications/NotificationService";

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

        await meetingReminderRepository.markReminderSent(schedule.id, now);
        processedCount += 1;
      }

      return new Output(true, [], [], { processedCount });
    } catch (error) {
      console.error("[MeetingReminderUseCase][processDueReminders] Erro:", error);
      return new Output(false, [], ["Erro ao processar lembretes de reunião"], null);
    }
  }
}

export const meetingReminderUseCase = new MeetingReminderUseCase();
