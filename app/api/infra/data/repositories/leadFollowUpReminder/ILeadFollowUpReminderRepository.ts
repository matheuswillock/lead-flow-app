import type { FollowUpKind } from "@/lib/lead-follow-up/reminder-plan"

export type NewFollowUpReminder = {
  leadId: string
  teamId: string
  kind: FollowUpKind
  /** "2d", "1d", "1h", "90d"... ou "custom:<data>" para contato extra. */
  offsetKey: string
  anchorAt: Date
  dueAt: Date
  eventLabel: string
  ownerProfileId: string
  notifyProfileIds: string[]
}

export type DueFollowUpReminder = {
  id: string
  leadId: string
  leadName: string
  teamId: string
  kind: FollowUpKind
  offsetKey: string
  anchorAt: Date
  eventLabel: string
  ownerProfileId: string
  notifyProfileIds: string[]
}

export type LeadReminderItem = {
  id: string
  offsetKey: string
  anchorAt: Date
  dueAt: Date
  processedAt: Date | null
}

export type LeadMeetingContext = {
  teamId: string | null
  name: string
  status: string | null
  isTransfer: boolean
  meetingDate: Date | null
  sdrProfileId: string | null
  timezone: string
}

export type UpcomingMeeting = { leadId: string; teamId: string; meetingDate: Date; sdrProfileId: string; timezone: string }

export type EndingPlan = {
  leadId: string
  teamId: string
  endsAt: Date
  closerProfileId: string | null
  masterProfileId: string
  managerProfileIds: string[]
}

export interface ILeadFollowUpReminderRepository {
  /** Troca os lembretes pendentes de um tipo no lead (ex.: entrevista remarcada). */
  replacePending(input: { leadId: string; kind: FollowUpKind; reminders: NewFollowUpReminder[] }): Promise<void>
  /** Cria os que ainda não existem (mesmo lead, tipo, evento e antecedência não duplica). */
  ensure(reminders: NewFollowUpReminder[]): Promise<number>
  findDue(input: { now: Date; limit: number }): Promise<DueFollowUpReminder[]>
  markProcessed(input: { id: string; taskId: string | null; processedAt: Date }): Promise<void>
  findUpcomingMeetings(input: { from: Date; until: Date }): Promise<UpcomingMeeting[]>
  findPlansEnding(input: { from: Date; until: Date }): Promise<EndingPlan[]>
  findLeadMeeting(leadId: string): Promise<LeadMeetingContext | null>
  listForLead(input: { leadId: string; kind: FollowUpKind; anchorAt: Date }): Promise<LeadReminderItem[]>
  /** Apaga um lembrete ainda pendente do lead; devolve se apagou. */
  deletePending(input: { id: string; leadId: string }): Promise<boolean>
}
