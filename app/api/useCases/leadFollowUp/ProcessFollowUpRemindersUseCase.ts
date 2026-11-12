import { Output } from "@/lib/output"
import { followUpCopy } from "@/lib/lead-follow-up/reminder-plan"
import type {
  DueFollowUpReminder,
  ILeadFollowUpReminderRepository,
} from "@/app/api/infra/data/repositories/leadFollowUpReminder/ILeadFollowUpReminderRepository"
import type { CreateFollowUpTask, NotifyProfile } from "./followUpPorts"

const BATCH_LIMIT = 200

/**
 * Lembretes vencidos viram tarefa para o dono (a criação da tarefa já escreve no feed do lead e
 * sincroniza com a agenda) e alerta para o dono e para quem mais precisa saber.
 */
export class ProcessFollowUpRemindersUseCase {
  constructor(
    private readonly repository: ILeadFollowUpReminderRepository,
    private readonly createTask: CreateFollowUpTask,
    private readonly notify: NotifyProfile,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async run(): Promise<Output> {
    const now = this.now()
    const due = await this.repository.findDue({ now, limit: BATCH_LIMIT })
    let tasks = 0
    let failures = 0

    for (const reminder of due) {
      const created = await this.processOne(reminder, now)
      if (created) tasks += 1
      else failures += 1
    }

    return new Output(true, ["Lembretes de acompanhamento processados"], [], { due: due.length, tasks, failures })
  }

  private async processOne(reminder: DueFollowUpReminder, now: Date): Promise<boolean> {
    const copy = followUpCopy(reminder.kind, reminder.offsetKey, {
      leadName: reminder.leadName,
      eventLabel: reminder.eventLabel,
    })

    const task = await this.createTask({
      leadId: reminder.leadId,
      teamId: reminder.teamId,
      ownerProfileId: reminder.ownerProfileId,
      title: copy.taskTitle,
      body: copy.taskBody,
      dueAt: reminder.anchorAt,
    })

    const recipients = [...new Set([reminder.ownerProfileId, ...reminder.notifyProfileIds])]
    const metadata = { leadId: reminder.leadId, kind: reminder.kind, offsetKey: reminder.offsetKey, taskId: task.taskId }
    for (const recipientProfileId of recipients) {
      await this.notify({ teamId: reminder.teamId, recipientProfileId, message: copy.notification, metadata }).catch((error) =>
        console.error("[ProcessFollowUpRemindersUseCase] Falha no alerta", { reminderId: reminder.id, error }),
      )
    }

    // Processado mesmo sem tarefa: o alerta já saiu e repetir geraria alertas duplicados.
    await this.repository.markProcessed({ id: reminder.id, taskId: task.taskId, processedAt: now })
    if (task.error) {
      console.error("[ProcessFollowUpRemindersUseCase] Tarefa não criada", { reminderId: reminder.id, error: task.error })
    }
    return task.taskId !== null
  }
}
