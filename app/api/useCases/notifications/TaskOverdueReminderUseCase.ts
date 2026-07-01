import { Output } from "@/lib/output";
import { backofficeBotRepository } from "@/app/api/infra/data/repositories/backofficeBot/BackofficeBotRepository";
import { taskOverdueReminderRepository } from "@/app/api/infra/data/repositories/taskOverdueReminder/TaskOverdueReminderRepository";
import { studioBotOutboxService } from "@/app/api/services/backofficeBot/StudioBotOutboxService";

export class TaskOverdueReminderUseCase {
  async processOverdueTasks(): Promise<Output> {
    try {
      const now = new Date();
      const overdueAssignees = await taskOverdueReminderRepository.findOverdueAssignees(now);

      let enqueuedCount = 0;

      for (const assignee of overdueAssignees) {
        const { task } = assignee;
        if (!task.lead) continue;

        const idempotencyKey = `task-overdue:${task.id}:${assignee.profileId}`;
        const existing = await backofficeBotRepository.findOutboxEventByIdempotencyKey(idempotencyKey);
        if (existing) continue;

        await studioBotOutboxService.enqueueTaskOverdue({
          profileId: assignee.profileId,
          leadId: task.lead.id,
          leadName: task.lead.name,
          taskId: task.id,
          title: task.title,
        });

        enqueuedCount += 1;
      }

      return new Output(true, [], [], { enqueuedCount });
    } catch (error) {
      console.error("[TaskOverdueReminderUseCase][processOverdueTasks] Erro:", error);
      return new Output(false, [], ["Erro ao processar tarefas em atraso"], null);
    }
  }
}

export const taskOverdueReminderUseCase = new TaskOverdueReminderUseCase();
