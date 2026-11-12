import { Output } from "@/lib/output"
import {
  MEETING_NURTURE_OFFSETS,
  PLAN_RENEWAL_OFFSETS,
  planReminders,
} from "@/lib/lead-follow-up/reminder-plan"
import type {
  ILeadFollowUpReminderRepository,
  NewFollowUpReminder,
} from "@/app/api/infra/data/repositories/leadFollowUpReminder/ILeadFollowUpReminderRepository"

import { meetingLabel, planEndLabel } from "./followUpLabels"

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Gera lembretes automáticos a partir dos dados do CRM:
 * - reuniões agendadas pelo SDR: 2 dias, 1 dia e 1 hora antes, para o SDR manter o lead aquecido;
 * - fim de vigência do plano na Carteira: 90, 60 e 30 dias antes, para closer, manager e master.
 * Rodar várias vezes é seguro: lembrete já criado não duplica.
 */
export class ScheduleAutomaticFollowUpsUseCase {
  constructor(
    private readonly repository: ILeadFollowUpReminderRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async scheduleMeetingNurture(): Promise<Output> {
    const now = this.now()
    const meetings = await this.repository.findUpcomingMeetings({
      from: now,
      until: new Date(now.getTime() + 3 * DAY_MS),
    })

    const reminders: NewFollowUpReminder[] = meetings.flatMap((meeting) =>
      planReminders({ anchorAt: meeting.meetingDate, offsetKeys: MEETING_NURTURE_OFFSETS, now }).map((planned) => ({
        leadId: meeting.leadId,
        teamId: meeting.teamId,
        kind: "meeting_nurture" as const,
        offsetKey: planned.offsetKey,
        anchorAt: meeting.meetingDate,
        dueAt: planned.dueAt,
        eventLabel: meetingLabel(meeting.meetingDate, meeting.timezone),
        ownerProfileId: meeting.sdrProfileId,
        notifyProfileIds: [],
      })),
    )

    const created = await this.repository.ensure(reminders)
    return new Output(true, [], [], { meetings: meetings.length, created })
  }

  async schedulePlanRenewals(): Promise<Output> {
    const now = this.now()
    const plans = await this.repository.findPlansEnding({ from: now, until: new Date(now.getTime() + 91 * DAY_MS) })

    const reminders: NewFollowUpReminder[] = plans.flatMap((plan) => {
      const owner = plan.closerProfileId ?? plan.masterProfileId
      const notify = [plan.masterProfileId, ...plan.managerProfileIds, ...(plan.closerProfileId ? [plan.closerProfileId] : [])]
      return planReminders({ anchorAt: plan.endsAt, offsetKeys: PLAN_RENEWAL_OFFSETS, now, graceMs: DAY_MS }).map(
        (planned) => ({
          leadId: plan.leadId,
          teamId: plan.teamId,
          kind: "plan_renewal" as const,
          offsetKey: planned.offsetKey,
          anchorAt: plan.endsAt,
          dueAt: planned.dueAt,
          eventLabel: planEndLabel(plan.endsAt),
          ownerProfileId: owner,
          notifyProfileIds: [...new Set(notify)].filter((id) => id !== owner),
        }),
      )
    })

    const created = await this.repository.ensure(reminders)
    return new Output(true, [], [], { plans: plans.length, created })
  }
}
