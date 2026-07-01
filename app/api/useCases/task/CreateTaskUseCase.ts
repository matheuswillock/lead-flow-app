import { Output } from "@/lib/output";
import { taskRepository } from "@/app/api/infra/data/repositories/task/TaskRepository";
import { notificationService } from "@/app/api/services/notifications/NotificationService";
import { studioBotOutboxService } from "@/app/api/services/backofficeBot/StudioBotOutboxService";
import { taskGoogleCalendarService } from "@/app/api/services/taskGoogleCalendar/TaskGoogleCalendarService";
import type { ICreateTaskUseCase, CreateTaskInput } from "./ICreateTaskUseCase";

export class CreateTaskUseCase implements ICreateTaskUseCase {
  async execute(input: CreateTaskInput): Promise<Output> {
    const lead = await taskRepository.findLeadInTeam(input.leadId, input.teamId);
    if (!lead) {
      return new Output(false, [], ["Lead não encontrado ou sem permissão no seu time."], null);
    }

    const uniqueAssigneeIds = Array.from(new Set(input.assigneeProfileIds));
    if (uniqueAssigneeIds.length === 0) {
      return new Output(false, [], ["Ao menos um responsável deve ser informado."], null);
    }

    const validAssigneeIds = await taskRepository.validateTeamMembers(input.teamId, uniqueAssigneeIds);
    if (validAssigneeIds.length === 0) {
      return new Output(false, [], ["Nenhum responsável pertence ao time."], null);
    }

    const creator = await taskRepository.findCreatorProfile(input.creatorProfileId);
    const actorName = creator?.fullName || creator?.email || "Usuário";
    if (input.startAt && input.endAt && input.endAt.getTime() < input.startAt.getTime()) {
      return new Output(false, [], ["A data de fim não pode ser anterior ao início."], null);
    }

    const task = await taskRepository.createActivityAndTask({
      leadId: input.leadId,
      title: input.title.trim(),
      taskType: input.taskType,
      body: input.body.trim(),
      isUrgent: input.isUrgent,
      startAt: input.startAt,
      endAt: input.endAt,
      createdBy: input.creatorProfileId,
      assigneeProfileIds: validAssigneeIds,
      activityDto: {
        leadId: input.leadId,
        title: input.title.trim(),
        taskType: input.taskType,
        body: input.body.trim(),
        createdBy: input.creatorProfileId,
        isUrgent: input.isUrgent,
        assigneeProfileIds: validAssigneeIds,
      },
    });

    let googleResults;
    try {
      googleResults = await taskGoogleCalendarService.createEventsForAssignees({
        taskId: task.id,
        taskTitle: task.title,
        body: task.body,
        isUrgent: task.isUrgent,
        startAt: task.startAt,
        endAt: task.endAt,
        leadCode: lead.leadCode,
        leadName: lead.name,
        assigneeProfileIds: validAssigneeIds,
      });
    } catch (err) {
      console.error("[CreateTaskUseCase] Erro ao sincronizar tarefa com Google Tasks:", err);
      googleResults = validAssigneeIds.map((profileId) => ({
        profileId,
        googleSynced: false,
        googleEventId: null,
        reason: "GOOGLE_SYNC_ERROR",
      }));
    }

    const notifyRecipients = validAssigneeIds.filter((id) => id !== input.creatorProfileId);
    if (notifyRecipients.length > 0) {
      try {
        await notificationService.createTaskAssignmentNotifications({
          teamId: input.teamId,
          actorProfileId: input.creatorProfileId,
          actorName,
          leadId: lead.id,
          leadCode: lead.leadCode ?? null,
          leadName: lead.name,
          taskId: task.id,
          body: task.body,
          recipientProfileIds: notifyRecipients,
        });

        for (const profileId of notifyRecipients) {
          await studioBotOutboxService.enqueueTaskDue({
            profileId,
            leadId: lead.id,
            leadName: lead.name,
            taskId: task.id,
            title: task.title,
          });
        }
      } catch (err) {
        console.error("[CreateTaskUseCase] Erro ao criar notificações de tarefa:", err);
      }
    }

    const successMessages = ["Tarefa criada com sucesso"];
    const failedGoogleSyncCount = googleResults.filter((result) => !result.googleSynced).length;
    if (failedGoogleSyncCount > 0) {
      successMessages.push(
        `Aviso: ${failedGoogleSyncCount} responsável(eis) sem sincronização no Google Tasks.`
      );
    }

    return new Output(true, successMessages, [], {
      task,
      googleSync: googleResults,
    });
  }
}

export const createTaskUseCase = new CreateTaskUseCase();
