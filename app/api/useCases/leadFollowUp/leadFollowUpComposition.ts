import { NotificationType, type Prisma } from "@prisma/client"
import { leadActivityRepository } from "@/app/api/infra/data/repositories/leadActivity/LeadActivityRepository"
import { leadFollowUpReminderRepository } from "@/app/api/infra/data/repositories/leadFollowUpReminder/LeadFollowUpReminderRepository"
import { notificationService } from "@/app/api/services/notifications/NotificationService"
import { createTaskUseCase } from "@/app/api/useCases/task/CreateTaskUseCase"
import type { AppendLeadActivity, CreateFollowUpTask, NotifyProfile } from "./followUpPorts"
import { ProcessFollowUpRemindersUseCase } from "./ProcessFollowUpRemindersUseCase"
import { ScheduleAutomaticFollowUpsUseCase } from "./ScheduleAutomaticFollowUpsUseCase"
import { LeadMeetingNurtureUseCase } from "./LeadMeetingNurtureUseCase"

/** Tarefa de 30 minutos que termina no horário do evento; a criação já escreve no feed e na agenda. */
export const createFollowUpTask: CreateFollowUpTask = async (input) => {
  const output = await createTaskUseCase.execute({
    leadId: input.leadId,
    teamId: input.teamId,
    creatorProfileId: input.ownerProfileId,
    assigneeProfileIds: [input.ownerProfileId],
    title: input.title.slice(0, 200),
    taskType: "whatsapp",
    body: input.body,
    isUrgent: false,
    startAt: new Date(input.dueAt.getTime() - 30 * 60 * 1000),
    endAt: input.dueAt,
  })
  const taskId = (output.result as { task?: { id?: string } } | null)?.task?.id ?? null
  return { taskId, error: output.isValid ? null : output.errorMessages.join(", ") }
}

export const notifyFollowUp: NotifyProfile = async (input) => {
  await notificationService.createSystemNotification({
    teamId: input.teamId,
    recipientProfileId: input.recipientProfileId,
    type: NotificationType.LEAD_FOLLOW_UP_REMINDER,
    message: input.message,
    metadata: input.metadata as Prisma.InputJsonValue,
  })
}

export const appendFollowUpActivity: AppendLeadActivity = async (input) => {
  await leadActivityRepository.create({
    leadId: input.leadId,
    type: input.type,
    body: input.body,
    createdBy: input.actorProfileId ?? undefined,
  })
}

export const processFollowUpRemindersUseCase = new ProcessFollowUpRemindersUseCase(
  leadFollowUpReminderRepository,
  createFollowUpTask,
  notifyFollowUp,
)

export const scheduleAutomaticFollowUpsUseCase = new ScheduleAutomaticFollowUpsUseCase(leadFollowUpReminderRepository)

export const leadMeetingNurtureUseCase = new LeadMeetingNurtureUseCase(leadFollowUpReminderRepository)
