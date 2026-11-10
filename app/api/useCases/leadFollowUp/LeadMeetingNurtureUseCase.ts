import { Output } from "@/lib/output"
import { MEETING_NURTURE_OFFSETS, offsetLabel, planReminders } from "@/lib/lead-follow-up/reminder-plan"
import {
  MEETING_NURTURE_PLAYBOOK,
  customNurtureKey,
  nurtureStepOf,
  type NurtureStep,
} from "@/lib/lead-follow-up/meeting-nurture-playbook"
import type {
  ILeadFollowUpReminderRepository,
  LeadMeetingContext,
} from "@/app/api/infra/data/repositories/leadFollowUpReminder/ILeadFollowUpReminderRepository"
import { meetingLabel } from "./followUpLabels"

export const NURTURE_LEAD_NOT_FOUND = "Lead não encontrado"
export const NURTURE_NO_MEETING = "O lead não tem reunião agendada"

export type NurtureContact = {
  id: string
  step: NurtureStep
  title: string
  tip: string
  /** "2 dias antes", "1 dia antes", "1 hora antes" ou "contato extra". */
  whenLabel: string
  dueAt: string
  done: boolean
  isCustom: boolean
}

type Scope = { leadId: string; teamId: string }

/**
 * Nutrição do lead até a reunião: a cadência fixa (2 dias, 1 dia e 1 hora antes, quando ainda cabem)
 * mais os contatos extras que o SDR adiciona. Cada contato vira tarefa + alerta na hora marcada.
 */
export class LeadMeetingNurtureUseCase {
  constructor(
    private readonly repository: ILeadFollowUpReminderRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private async scheduledMeeting(scope: Scope): Promise<(LeadMeetingContext & { meetingDate: Date; sdrProfileId: string }) | Output> {
    const lead = await this.repository.findLeadMeeting(scope.leadId)
    if (!lead || lead.teamId !== scope.teamId) return new Output(false, [], [NURTURE_LEAD_NOT_FOUND], null)
    if (lead.status !== "scheduled" || lead.isTransfer || !lead.meetingDate || !lead.sdrProfileId) {
      return new Output(false, [], [NURTURE_NO_MEETING], null)
    }
    return { ...lead, meetingDate: lead.meetingDate, sdrProfileId: lead.sdrProfileId }
  }

  async list(scope: Scope): Promise<Output> {
    const meeting = await this.scheduledMeeting(scope)
    if (meeting instanceof Output) {
      return meeting.errorMessages.includes(NURTURE_NO_MEETING)
        ? new Output(true, [], [], { meetingAt: null, contacts: [] })
        : meeting
    }

    // A cadência fixa aparece mesmo antes da rodada automática: criar de novo não duplica.
    await this.repository.ensure(
      planReminders({ anchorAt: meeting.meetingDate, offsetKeys: MEETING_NURTURE_OFFSETS, now: this.now() }).map(
        (planned) => ({
          leadId: scope.leadId,
          teamId: scope.teamId,
          kind: "meeting_nurture" as const,
          offsetKey: planned.offsetKey,
          anchorAt: meeting.meetingDate,
          dueAt: planned.dueAt,
          eventLabel: meetingLabel(meeting.meetingDate, meeting.timezone),
          ownerProfileId: meeting.sdrProfileId,
          notifyProfileIds: [],
        }),
      ),
    )

    const items = await this.repository.listForLead({
      leadId: scope.leadId,
      kind: "meeting_nurture",
      anchorAt: meeting.meetingDate,
    })
    const contacts: NurtureContact[] = items.map((item) => {
      const step = nurtureStepOf(item.offsetKey)
      return {
        id: item.id,
        step,
        title: MEETING_NURTURE_PLAYBOOK[step].title,
        tip: MEETING_NURTURE_PLAYBOOK[step].tip,
        whenLabel: offsetLabel(item.offsetKey),
        dueAt: item.dueAt.toISOString(),
        done: item.processedAt !== null,
        isCustom: step === "custom",
      }
    })
    return new Output(true, [], [], { meetingAt: meeting.meetingDate.toISOString(), contacts })
  }

  async addContact(scope: Scope & { dueAt: string }): Promise<Output> {
    const dueAt = new Date(scope.dueAt)
    if (Number.isNaN(dueAt.getTime())) return new Output(false, [], ["Informe a data e a hora do contato"], null)

    const meeting = await this.scheduledMeeting(scope)
    if (meeting instanceof Output) return meeting
    if (dueAt.getTime() <= this.now().getTime()) {
      return new Output(false, [], ["Escolha um horário a partir de agora"], null)
    }
    if (dueAt.getTime() >= meeting.meetingDate.getTime()) {
      return new Output(false, [], ["O contato precisa ser antes da reunião"], null)
    }

    await this.repository.ensure([
      {
        leadId: scope.leadId,
        teamId: scope.teamId,
        kind: "meeting_nurture",
        offsetKey: customNurtureKey(dueAt.toISOString()),
        anchorAt: meeting.meetingDate,
        dueAt,
        eventLabel: meetingLabel(meeting.meetingDate, meeting.timezone),
        ownerProfileId: meeting.sdrProfileId,
        notifyProfileIds: [],
      },
    ])
    return this.list(scope)
  }

  async removeContact(scope: Scope & { contactId: string }): Promise<Output> {
    const meeting = await this.scheduledMeeting(scope)
    if (meeting instanceof Output) return meeting
    const removed = await this.repository.deletePending({ id: scope.contactId, leadId: scope.leadId })
    if (!removed) return new Output(false, [], ["Este contato já aconteceu ou não existe mais"], null)
    return this.list(scope)
  }
}
