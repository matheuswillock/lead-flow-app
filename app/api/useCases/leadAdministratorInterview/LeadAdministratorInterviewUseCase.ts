import { Output } from "@/lib/output"
import { formatInterviewLocal } from "@/lib/lead-interview/interview-whatsapp"
import {
  INTERVIEW_REMINDER_OFFSETS,
  isFollowUpOffsetKey,
  planReminders,
  type FollowUpOffsetKey,
} from "@/lib/lead-follow-up/reminder-plan"
import type { ILeadAdministratorInterviewRepository } from "@/app/api/infra/data/repositories/leadAdministratorInterview/ILeadAdministratorInterviewRepository"
import type { ILeadFollowUpReminderRepository } from "@/app/api/infra/data/repositories/leadFollowUpReminder/ILeadFollowUpReminderRepository"
import type { AppendLeadActivity, CreateFollowUpTask } from "@/app/api/useCases/leadFollowUp/followUpPorts"

export const LEAD_NOT_FOUND = "Lead não encontrado"
export const INTERVIEW_NOT_FOUND = "Registre a entrevista antes de avisar o cliente"

const LOCAL_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/
const HOUR_MS = 60 * 60 * 1000

export type InterviewScope = { leadId: string; teamId: string; profileId: string }

export type SaveInterviewCommand = InterviewScope & {
  /** Instante da entrevista (para agendar lembretes). */
  scheduledAt: string
  /** Data/hora como o usuário digitou; é a que vai na mensagem. */
  scheduledLocal: string
  administratorName?: string | null
  notes?: string | null
  /** Quando lembrar o usuário de avisar o cliente de novo: "2d", "1d", "1h". */
  reminderOffsets?: string[]
}

const trimOrNull = (value?: string | null) => (value?.trim() ? value.trim() : null)

/**
 * Entrevista da administradora: o usuário registra a data, avisa o cliente pelo próprio WhatsApp e
 * escolhe quando ser lembrado de avisar de novo. Tudo fica no feed do lead.
 */
export class LeadAdministratorInterviewUseCase {
  constructor(
    private readonly interviews: ILeadAdministratorInterviewRepository,
    private readonly reminders: ILeadFollowUpReminderRepository,
    private readonly createTask: CreateFollowUpTask,
    private readonly appendActivity: AppendLeadActivity,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private async leadInTeam(leadId: string, teamId: string) {
    const lead = await this.interviews.findLead(leadId)
    return lead && lead.teamId === teamId ? lead : null
  }

  async get(leadId: string, teamId: string): Promise<Output> {
    if (!(await this.leadInTeam(leadId, teamId))) return new Output(false, [], [LEAD_NOT_FOUND], null)
    return new Output(true, [], [], { interview: await this.interviews.findByLeadId(leadId) })
  }

  async save(command: SaveInterviewCommand): Promise<Output> {
    const scheduledAt = new Date(command.scheduledAt)
    if (Number.isNaN(scheduledAt.getTime()) || !LOCAL_PATTERN.test(command.scheduledLocal)) {
      return new Output(false, [], ["Informe a data e a hora da entrevista"], null)
    }
    const lead = await this.leadInTeam(command.leadId, command.teamId)
    if (!lead) return new Output(false, [], [LEAD_NOT_FOUND], null)

    const interview = await this.interviews.save({
      leadId: command.leadId,
      teamId: command.teamId,
      scheduledAt,
      scheduledLocal: command.scheduledLocal,
      administratorName: trimOrNull(command.administratorName),
      notes: trimOrNull(command.notes),
      updatedByProfileId: command.profileId,
    })

    const offsets = (command.reminderOffsets ?? []).filter(
      (key): key is FollowUpOffsetKey => isFollowUpOffsetKey(key) && INTERVIEW_REMINDER_OFFSETS.includes(key),
    )
    const planned = planReminders({ anchorAt: scheduledAt, offsetKeys: offsets, now: this.now() })
    await this.reminders.replacePending({
      leadId: command.leadId,
      kind: "administrator_interview",
      reminders: planned.map((reminder) => ({
        leadId: command.leadId,
        teamId: command.teamId,
        kind: "administrator_interview",
        offsetKey: reminder.offsetKey,
        anchorAt: scheduledAt,
        dueAt: reminder.dueAt,
        eventLabel: formatInterviewLocal(command.scheduledLocal),
        ownerProfileId: command.profileId,
        notifyProfileIds: [],
      })),
    })

    await this.appendActivity({
      leadId: command.leadId,
      actorProfileId: command.profileId,
      type: "note",
      body: `Entrevista da administradora registrada para ${formatInterviewLocal(command.scheduledLocal)}.`,
    })

    return new Output(true, ["Entrevista salva"], [], {
      interview,
      reminderOffsets: planned.map((reminder) => reminder.offsetKey),
    })
  }

  /** O usuário abriu o WhatsApp com a mensagem pronta: registra o aviso no feed. */
  async markClientNotified(scope: InterviewScope): Promise<Output> {
    if (!(await this.leadInTeam(scope.leadId, scope.teamId))) return new Output(false, [], [LEAD_NOT_FOUND], null)
    const current = await this.interviews.findByLeadId(scope.leadId)
    if (!current) return new Output(false, [], [INTERVIEW_NOT_FOUND], null)

    const interview = await this.interviews.markClientNotified(scope.leadId, this.now())
    await this.appendActivity({
      leadId: scope.leadId,
      actorProfileId: scope.profileId,
      type: "whatsapp",
      body: `Cliente avisado pelo WhatsApp sobre a entrevista da administradora (${formatInterviewLocal(current.scheduledLocal)}).`,
    })
    return new Output(true, ["Aviso registrado no feed do lead"], [], { interview })
  }

  /** O usuário preferiu não avisar agora: fica uma tarefa pendente para ele. */
  async postponeClientNotice(scope: InterviewScope): Promise<Output> {
    const lead = await this.leadInTeam(scope.leadId, scope.teamId)
    if (!lead) return new Output(false, [], [LEAD_NOT_FOUND], null)
    const current = await this.interviews.findByLeadId(scope.leadId)
    if (!current) return new Output(false, [], [INTERVIEW_NOT_FOUND], null)

    const task = await this.createTask({
      leadId: scope.leadId,
      teamId: scope.teamId,
      ownerProfileId: scope.profileId,
      title: `Avisar ${lead.name} sobre a entrevista da administradora`,
      body: `Pendente: avisar o cliente da entrevista de ${formatInterviewLocal(current.scheduledLocal)}. Abra o lead e use "Avisar cliente no WhatsApp".`,
      dueAt: new Date(this.now().getTime() + HOUR_MS),
    })
    if (!task.taskId) return new Output(false, [], [task.error ?? "Não foi possível criar a tarefa"], null)
    return new Output(true, ["Tarefa criada: avisar o cliente sobre a entrevista"], [], { taskId: task.taskId })
  }

  async remove(scope: InterviewScope): Promise<Output> {
    if (!(await this.leadInTeam(scope.leadId, scope.teamId))) return new Output(false, [], [LEAD_NOT_FOUND], null)
    await this.interviews.deleteByLeadId(scope.leadId)
    await this.reminders.replacePending({ leadId: scope.leadId, kind: "administrator_interview", reminders: [] })
    return new Output(true, ["Entrevista removida"], [], { interview: null })
  }
}
