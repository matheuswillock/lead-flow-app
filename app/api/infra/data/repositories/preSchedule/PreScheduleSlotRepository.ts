import { LeadStatus } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import type { IPreScheduleSlotRepository } from "./IPreScheduleSlotRepository"

const TERMINAL_STATUSES: LeadStatus[] = [
  LeadStatus.opportunityLost,
  LeadStatus.disqualified,
  LeadStatus.operator_denied,
  LeadStatus.contract_finalized,
]

export class PreScheduleSlotRepository implements IPreScheduleSlotRepository {
  async countTransferRoutesBySourceTeam(teamId: string): Promise<number> {
    return prisma.teamTransferRoute.count({ where: { sourceTeamId: teamId } })
  }

  async findTeamMasterTimezone(teamId: string): Promise<string | null> {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { master: { select: { timezone: true } } },
    })

    return team?.master?.timezone ?? null
  }

  async findTransferLeadMeetingDatesInDay(
    teamId: string,
    dayStart: Date,
    dayEnd: Date,
    excludeLeadId?: string
  ): Promise<Array<{ meetingDate: Date | null }>> {
    return prisma.lead.findMany({
      where: {
        teamId,
        isTransfer: true,
        status: { not: null },
        ...(excludeLeadId ? { id: { not: excludeLeadId } } : {}),
        closerId: null,
        meetingDate: { gte: dayStart, lt: dayEnd },
        NOT: {
          status: { in: TERMINAL_STATUSES },
        },
      },
      select: { meetingDate: true },
    })
  }
}

export const preScheduleSlotRepository = new PreScheduleSlotRepository()
