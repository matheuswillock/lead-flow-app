import type { UserFunction } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import type {
  IBackofficeOperatorLinksRepository,
  OperatorLinkedTeam,
  OperatorTeamMemberRef,
  OperatorTeamScope,
} from "./IBackofficeOperatorLinksRepository"

const OPERATOR_LINK_WHERE = {
  role: "operator",
  isSupportAccess: false,
  team: { deletedAt: null },
} as const

export class BackofficeOperatorLinksRepository implements IBackofficeOperatorLinksRepository {
  async findLinkedTeams(profileId: string): Promise<OperatorLinkedTeam[]> {
    const rows = await prisma.teamMember.findMany({
      where: { profileId, ...OPERATOR_LINK_WHERE },
      select: {
        id: true,
        teamId: true,
        team: {
          select: {
            name: true,
            masterId: true,
            master: { select: { fullName: true, email: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    })

    return rows.map((row) => ({
      memberId: row.id,
      teamId: row.teamId,
      teamName: row.team.name,
      masterId: row.team.masterId,
      masterName: row.team.master.fullName,
      masterEmail: row.team.master.email,
    }))
  }

  async findActiveTeams(teamIds: string[]): Promise<OperatorTeamScope[]> {
    if (teamIds.length === 0) return []

    const teams = await prisma.team.findMany({
      where: { id: { in: teamIds }, deletedAt: null },
      select: { id: true, masterId: true },
    })

    return teams.map((team) => ({ teamId: team.id, masterId: team.masterId }))
  }

  async addTeams(
    profileId: string,
    teamIds: string[],
    functions: UserFunction[]
  ): Promise<OperatorTeamMemberRef[]> {
    if (teamIds.length === 0) return []

    const rows = await prisma.$transaction(
      teamIds.map((teamId) =>
        prisma.teamMember.upsert({
          where: { teamId_profileId: { teamId, profileId } },
          create: { teamId, profileId, role: "operator", functions },
          update: { role: "operator", functions, isSupportAccess: false },
          select: { id: true, teamId: true },
        })
      )
    )

    return rows.map((row) => ({ memberId: row.id, teamId: row.teamId }))
  }

  async removeTeams(profileId: string, teamIds: string[]): Promise<OperatorTeamMemberRef[]> {
    if (teamIds.length === 0) return []

    const rows = await prisma.teamMember.findMany({
      where: { profileId, teamId: { in: teamIds }, ...OPERATOR_LINK_WHERE },
      select: { id: true, teamId: true },
    })
    if (rows.length === 0) return []

    await prisma.teamMember.deleteMany({
      where: { id: { in: rows.map((row) => row.id) } },
    })

    return rows.map((row) => ({ memberId: row.id, teamId: row.teamId }))
  }

  async updateFunctions(profileId: string, functions: UserFunction[]): Promise<void> {
    await prisma.teamMember.updateMany({
      where: { profileId, ...OPERATOR_LINK_WHERE },
      data: { functions },
    })
  }
}
