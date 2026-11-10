import { prisma } from "@/app/api/infra/data/prisma"
import type {
  IBackofficeSupportRepository,
  SupportAccountSearchItem,
  SupportManagerRef,
  SupportTeamDetails,
} from "./IBackofficeSupportRepository"

const MAX_TEAMS_PER_ACCOUNT = 20

export class BackofficeSupportRepository implements IBackofficeSupportRepository {
  async findActiveSupportManager(profileId: string): Promise<SupportManagerRef | null> {
    const user = await prisma.backofficeUser.findFirst({
      where: { profileId, isActive: true, fullAccess: true },
      select: { id: true, email: true },
    })

    return user ? { backofficeUserId: user.id, email: user.email } : null
  }

  async searchAccounts(query: string, limit: number): Promise<SupportAccountSearchItem[]> {
    const accounts = await prisma.profile.findMany({
      where: {
        isMaster: true,
        deletedAt: null,
        teamsOwned: { some: { deletedAt: null } },
        OR: [
          { fullName: { contains: query, mode: "insensitive" } },
          { email: { contains: query, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        teamsOwned: {
          where: { deletedAt: null },
          select: { id: true, name: true },
          orderBy: [{ isDefault: "desc" }, { name: "asc" }],
          take: MAX_TEAMS_PER_ACCOUNT,
        },
      },
      orderBy: { fullName: "asc" },
      take: limit,
    })

    return accounts.map((account) => ({
      masterId: account.id,
      masterName: account.fullName,
      masterEmail: account.email,
      teams: account.teamsOwned,
    }))
  }

  async findActiveTeam(teamId: string): Promise<SupportTeamDetails | null> {
    const team = await prisma.team.findFirst({
      where: { id: teamId, deletedAt: null, master: { isMaster: true, deletedAt: null } },
      select: {
        id: true,
        name: true,
        masterId: true,
        isDefault: true,
        createdAt: true,
        master: { select: { fullName: true, email: true } },
      },
    })
    if (!team) return null

    const accountTeamsCount = await prisma.team.count({
      where: { masterId: team.masterId, deletedAt: null },
    })

    return {
      id: team.id,
      name: team.name,
      masterId: team.masterId,
      masterName: team.master.fullName,
      masterEmail: team.master.email,
      isDefault: team.isDefault,
      createdAt: team.createdAt,
      accountTeamsCount,
    }
  }
}

export const backofficeSupportRepository = new BackofficeSupportRepository()
