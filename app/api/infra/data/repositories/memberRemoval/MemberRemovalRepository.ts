import { UserRole } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import type {
  IMemberRemovalRepository,
  OrphanNotificationRow,
  ReleasedLead,
  RemovedProfile,
} from "./IMemberRemovalRepository"

export class MemberRemovalRepository implements IMemberRemovalRepository {
  async releaseLeadsOfMember(teamId: string, profileId: string): Promise<ReleasedLead[]> {
    return prisma.$transaction(async (tx) => {
      // Leads da carteira ficam de fora: o cliente continua com o nome atribuído (histórico).
      const leads = await tx.lead.findMany({
        where: {
          teamId,
          deletedAt: null,
          portfolio: { is: null },
          OR: [{ assignedTo: profileId }, { closerId: profileId }],
        },
        select: { id: true, leadCode: true, name: true, status: true },
      })
      if (leads.length === 0) return []

      const ids = leads.map((lead) => lead.id)
      await tx.lead.updateMany({ where: { id: { in: ids }, assignedTo: profileId }, data: { assignedTo: null } })
      await tx.lead.updateMany({ where: { id: { in: ids }, closerId: profileId }, data: { closerId: null } })

      return leads.map((lead) => ({ id: lead.id, leadCode: lead.leadCode, name: lead.name, status: lead.status }))
    })
  }

  async findRedistributionRecipientIds(teamId: string): Promise<string[]> {
    const team = await prisma.team.findFirst({
      where: { id: teamId },
      select: {
        masterId: true,
        members: { where: { role: UserRole.manager }, select: { profileId: true } },
      },
    })
    if (!team) return []
    return [team.masterId, ...team.members.map((member) => member.profileId)].filter(
      (id): id is string => typeof id === "string" && id.length > 0,
    )
  }

  async findProfileForRemoval(profileId: string): Promise<RemovedProfile | null> {
    return prisma.profile.findUnique({
      where: { id: profileId },
      select: { fullName: true, email: true, supabaseId: true },
    })
  }

  async createLeadOrphanNotifications(rows: OrphanNotificationRow[]): Promise<{ count: number }> {
    if (rows.length === 0) return { count: 0 }
    return prisma.notification.createMany({ data: rows.map((row) => ({ ...row })) })
  }

  async countRemainingTeamMemberships(profileId: string): Promise<number> {
    return prisma.teamMember.count({ where: { profileId, team: { deletedAt: null } } })
  }

  async moveActiveTeamAway(profileId: string, removedTeamId: string): Promise<void> {
    const next = await prisma.teamMember.findFirst({
      where: { profileId, teamId: { not: removedTeamId }, team: { deletedAt: null } },
      select: { teamId: true },
      orderBy: { teamId: "asc" },
    })
    // Só mexe no perfil cujo time ativo era o removido; quem já usa outro time não é alterado.
    await prisma.profile.updateMany({
      where: { id: profileId, activeTeamId: removedTeamId },
      data: { activeTeamId: next?.teamId ?? null },
    })
  }

  async revokeAuthSessions(authUserId: string): Promise<void> {
    // Apaga as sessões (e, em cascata, os refresh tokens) do Supabase Auth: o login cai na próxima requisição.
    await prisma.$executeRaw`DELETE FROM auth.sessions WHERE user_id = ${authUserId}::uuid`
  }
}

export const memberRemovalRepository = new MemberRemovalRepository()
