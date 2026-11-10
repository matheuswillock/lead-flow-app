import { prisma } from "@/app/api/infra/data/prisma"
import { resolveTimezone } from "@/lib/dates"
import { isFollowUpOffsetKey, type FollowUpKind } from "@/lib/lead-follow-up/reminder-plan"
import { CUSTOM_NURTURE_PREFIX } from "@/lib/lead-follow-up/meeting-nurture-playbook"
import type {
  DueFollowUpReminder,
  EndingPlan,
  ILeadFollowUpReminderRepository,
  LeadMeetingContext,
  LeadReminderItem,
  NewFollowUpReminder,
  UpcomingMeeting,
} from "./ILeadFollowUpReminderRepository"

const KINDS: readonly FollowUpKind[] = ["administrator_interview", "meeting_nurture", "plan_renewal"]

function toRow(reminder: NewFollowUpReminder) {
  return { ...reminder }
}

export class LeadFollowUpReminderRepository implements ILeadFollowUpReminderRepository {
  async replacePending(input: { leadId: string; kind: FollowUpKind; reminders: NewFollowUpReminder[] }): Promise<void> {
    await prisma.$transaction([
      prisma.leadFollowUpReminder.deleteMany({ where: { leadId: input.leadId, kind: input.kind, processedAt: null } }),
      prisma.leadFollowUpReminder.createMany({ data: input.reminders.map(toRow), skipDuplicates: true }),
    ])
  }

  async ensure(reminders: NewFollowUpReminder[]): Promise<number> {
    if (reminders.length === 0) return 0
    const result = await prisma.leadFollowUpReminder.createMany({ data: reminders.map(toRow), skipDuplicates: true })
    return result.count
  }

  async findDue(input: { now: Date; limit: number }): Promise<DueFollowUpReminder[]> {
    const rows = await prisma.leadFollowUpReminder.findMany({
      where: { processedAt: null, dueAt: { lte: input.now } },
      orderBy: { dueAt: "asc" },
      take: input.limit,
    })
    if (rows.length === 0) return []
    const leads = await prisma.lead.findMany({
      where: { id: { in: [...new Set(rows.map((row) => row.leadId))] } },
      select: { id: true, name: true },
    })
    const nameById = new Map(leads.map((lead) => [lead.id, lead.name]))

    return rows.flatMap((row) => {
      const kind = KINDS.find((item) => item === row.kind)
      const knownOffset = isFollowUpOffsetKey(row.offsetKey) || row.offsetKey.startsWith(CUSTOM_NURTURE_PREFIX)
      if (!kind || !knownOffset) return []
      return [
        {
          id: row.id,
          leadId: row.leadId,
          leadName: nameById.get(row.leadId) ?? "Lead",
          teamId: row.teamId,
          kind,
          offsetKey: row.offsetKey,
          anchorAt: row.anchorAt,
          eventLabel: row.eventLabel,
          ownerProfileId: row.ownerProfileId,
          notifyProfileIds: row.notifyProfileIds,
        },
      ]
    })
  }

  async markProcessed(input: { id: string; taskId: string | null; processedAt: Date }): Promise<void> {
    await prisma.leadFollowUpReminder.update({
      where: { id: input.id },
      data: { processedAt: input.processedAt, taskId: input.taskId },
    })
  }

  async findUpcomingMeetings(input: { from: Date; until: Date }): Promise<UpcomingMeeting[]> {
    const leads = await prisma.lead.findMany({
      where: {
        status: "scheduled",
        isTransfer: false,
        meetingDate: { gt: input.from, lte: input.until },
        assignedTo: { not: null },
        teamId: { not: null },
      },
      select: { id: true, teamId: true, meetingDate: true, assignedTo: true, team: { select: { master: { select: { timezone: true } } } } },
    })
    return leads.flatMap((lead) =>
      lead.teamId && lead.meetingDate && lead.assignedTo
        ? [
            {
              leadId: lead.id,
              teamId: lead.teamId,
              meetingDate: lead.meetingDate,
              sdrProfileId: lead.assignedTo,
              timezone: resolveTimezone(lead.team?.master?.timezone),
            },
          ]
        : [],
    )
  }

  async findPlansEnding(input: { from: Date; until: Date }): Promise<EndingPlan[]> {
    const portfolios = await prisma.leadPortfolio.findMany({
      where: { portfolioStatus: "active", lead: { contractDueDate: { gt: input.from, lte: input.until } } },
      select: {
        leadId: true,
        teamId: true,
        lead: { select: { contractDueDate: true, closerId: true } },
        team: { select: { masterId: true } },
      },
    })
    if (portfolios.length === 0) return []

    const teamIds = [...new Set(portfolios.map((item) => item.teamId))]
    const managers = await prisma.teamMember.findMany({
      where: { teamId: { in: teamIds }, role: "manager" },
      select: { teamId: true, profileId: true },
    })
    const managersByTeam = new Map<string, string[]>()
    for (const manager of managers) {
      managersByTeam.set(manager.teamId, [...(managersByTeam.get(manager.teamId) ?? []), manager.profileId])
    }

    return portfolios.flatMap((item) =>
      item.lead.contractDueDate
        ? [
            {
              leadId: item.leadId,
              teamId: item.teamId,
              endsAt: item.lead.contractDueDate,
              closerProfileId: item.lead.closerId,
              masterProfileId: item.team.masterId,
              managerProfileIds: managersByTeam.get(item.teamId) ?? [],
            },
          ]
        : [],
    )
  }

  async findLeadMeeting(leadId: string): Promise<LeadMeetingContext | null> {
    return findLeadMeetingContext(leadId)
  }

  async listForLead(input: { leadId: string; kind: FollowUpKind; anchorAt: Date }): Promise<LeadReminderItem[]> {
    return prisma.leadFollowUpReminder.findMany({
      where: { leadId: input.leadId, kind: input.kind, anchorAt: input.anchorAt },
      orderBy: { dueAt: "asc" },
      select: { id: true, offsetKey: true, anchorAt: true, dueAt: true, processedAt: true },
    })
  }

  async deletePending(input: { id: string; leadId: string }): Promise<boolean> {
    const result = await prisma.leadFollowUpReminder.deleteMany({
      where: { id: input.id, leadId: input.leadId, processedAt: null },
    })
    return result.count > 0
  }
}

export const leadFollowUpReminderRepository = new LeadFollowUpReminderRepository()

async function findLeadMeetingContext(leadId: string): Promise<LeadMeetingContext | null> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: {
      teamId: true,
      name: true,
      status: true,
      isTransfer: true,
      meetingDate: true,
      assignedTo: true,
      team: { select: { master: { select: { timezone: true } } } },
    },
  })
  if (!lead) return null
  return {
    teamId: lead.teamId,
    name: lead.name,
    status: lead.status,
    isTransfer: lead.isTransfer,
    meetingDate: lead.meetingDate,
    sdrProfileId: lead.assignedTo,
    timezone: resolveTimezone(lead.team?.master?.timezone),
  }
}
