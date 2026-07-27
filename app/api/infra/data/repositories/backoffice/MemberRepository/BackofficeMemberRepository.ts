import type { UserFunction, UserRole } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import type {
  IBackofficeMemberRepository,
  MemberAccountMembershipTemplate,
  MemberAccountTeamMembershipItem,
  MemberForDeletionRecord,
  MemberForUpdateRecord,
  MemberProfileRoleContext,
  MemberTeamMembershipRecord,
} from "./IBackofficeMemberRepository"

export class BackofficeMemberRepository implements IBackofficeMemberRepository {
  async findAdminEmailByProfileId(profileId: string): Promise<string | null> {
    const profile = await prisma.profile.findUnique({
      where: { id: profileId },
      select: { email: true },
    })
    return profile?.email ?? null
  }

  async findMemberForUpdate(memberId: string): Promise<MemberForUpdateRecord | null> {
    const profile = await prisma.profile.findUnique({
      where: { id: memberId },
      select: {
        id: true,
        supabaseId: true,
        email: true,
        fullName: true,
        phone: true,
        isMaster: true,
      },
    })

    return profile
  }

  async updateMemberProfile(
    memberId: string,
    data: {
      fullName?: string | null
      phone?: string | null
      email?: string
    }
  ): Promise<{ id: string } | null> {
    const payload: Record<string, unknown> = {}

    if (data.fullName !== undefined) payload.fullName = data.fullName
    if (data.phone !== undefined) payload.phone = data.phone
    if (data.email !== undefined) payload.email = data.email

    if (Object.keys(payload).length === 0) {
      const existing = await prisma.profile.findUnique({
        where: { id: memberId },
        select: { id: true },
      })
      return existing
    }

    try {
      const updated = await prisma.profile.update({
        where: { id: memberId },
        data: payload,
        select: { id: true },
      })
      return updated
    } catch (error) {
      console.error("[BackofficeMemberRepository][updateMemberProfile]", error)
      return null
    }
  }

  async findMemberForDeletion(memberId: string): Promise<MemberForDeletionRecord | null> {
    const profile = await prisma.profile.findFirst({
      where: { id: memberId, deletedAt: null },
      select: {
        id: true,
        supabaseId: true,
        email: true,
        fullName: true,
        isMaster: true,
        managerId: true,
        subscription: { select: { asaasSubscriptionId: true } },
      },
    })

    if (!profile) return null

    return {
      id: profile.id,
      supabaseId: profile.supabaseId,
      email: profile.email,
      fullName: profile.fullName,
      isMaster: profile.isMaster,
      managerId: profile.managerId,
      subscriptionAsaasId: profile.subscription?.asaasSubscriptionId ?? null,
    }
  }

  async deleteMemberCascade(memberId: string): Promise<void> {
    // Legacy name — soft-delete sem request (uso interno legado). Preferir softDeleteMemberCascade.
    await this.softDeleteMemberCascade(memberId, memberId, null)
  }

  async softDeleteMemberCascade(
    memberId: string,
    actorProfileId: string,
    requestId?: string | null
  ): Promise<void> {
    const now = new Date()

    await prisma.$transaction(async (tx) => {
      const profile = await tx.profile.findFirst({
        where: { id: memberId, deletedAt: null },
        select: { id: true, isMaster: true, managerId: true, email: true, fullName: true },
      })
      if (!profile) {
        throw new Error("Membro não encontrado ou já excluído")
      }

      await tx.lead.updateMany({
        where: { assignedTo: memberId, deletedAt: null },
        data: { assignedTo: null },
      })
      await tx.lead.updateMany({
        where: { closerId: memberId, deletedAt: null },
        data: { closerId: null },
      })

      await tx.teamMember.deleteMany({ where: { profileId: memberId } })

      if (profile.isMaster) {
        const teams = await tx.team.findMany({
          where: { masterId: memberId, deletedAt: null },
          select: { id: true },
        })
        const teamIds = teams.map((t) => t.id)

        if (teamIds.length > 0) {
          await tx.lead.updateMany({
            where: { teamId: { in: teamIds }, deletedAt: null },
            data: { deletedAt: now, deletedByProfileId: actorProfileId },
          })
          await tx.team.updateMany({
            where: { id: { in: teamIds }, deletedAt: null },
            data: { deletedAt: now, deletedByProfileId: actorProfileId },
          })

          for (const teamId of teamIds) {
            await tx.backofficeDeletionAuditLog.create({
              data: {
                entityType: "TEAM",
                entityId: teamId,
                action: "soft_delete_cascade_master",
                actorProfileId,
                requestId: requestId ?? null,
                payload: { masterId: memberId },
              },
            })
          }

          await tx.backofficeDeletionAuditLog.create({
            data: {
              entityType: "LEAD",
              entityId: memberId,
              action: "soft_delete_leads_cascade_master",
              actorProfileId,
              requestId: requestId ?? null,
              payload: { teamIds, leadScope: "teams_of_master" },
            },
          })
        }

        await tx.lead.updateMany({
          where: { managerId: memberId, deletedAt: null },
          data: { deletedAt: now, deletedByProfileId: actorProfileId },
        })
      }

      await tx.profile.update({
        where: { id: memberId },
        data: { deletedAt: now, deletedByProfileId: actorProfileId },
      })

      await tx.backofficeDeletionAuditLog.create({
        data: {
          entityType: "PROFILE",
          entityId: memberId,
          action: profile.isMaster ? "soft_delete_master" : "soft_delete_user",
          actorProfileId,
          requestId: requestId ?? null,
          payload: {
            email: profile.email,
            fullName: profile.fullName,
            isMaster: profile.isMaster,
          },
        },
      })
    })
  }

  async softDeleteTeamCascade(
    teamId: string,
    actorProfileId: string,
    requestId?: string | null
  ): Promise<void> {
    const now = new Date()

    await prisma.$transaction(async (tx) => {
      const team = await tx.team.findFirst({
        where: { id: teamId, deletedAt: null },
        select: { id: true, name: true, masterId: true },
      })
      if (!team) {
        throw new Error("Time não encontrado ou já excluído")
      }

      await tx.lead.updateMany({
        where: { teamId, deletedAt: null },
        data: { deletedAt: now, deletedByProfileId: actorProfileId },
      })

      await tx.team.update({
        where: { id: teamId },
        data: { deletedAt: now, deletedByProfileId: actorProfileId },
      })

      await tx.backofficeDeletionAuditLog.create({
        data: {
          entityType: "TEAM",
          entityId: teamId,
          action: "soft_delete_team",
          actorProfileId,
          requestId: requestId ?? null,
          payload: { name: team.name, masterId: team.masterId },
        },
      })

      await tx.backofficeDeletionAuditLog.create({
        data: {
          entityType: "LEAD",
          entityId: teamId,
          action: "soft_delete_leads_of_team",
          actorProfileId,
          requestId: requestId ?? null,
          payload: { teamId },
        },
      })
    })
  }

  async findTeamMembership(
    teamId: string,
    profileId: string
  ): Promise<MemberTeamMembershipRecord | null> {
    const membership = await prisma.teamMember.findUnique({
      where: { teamId_profileId: { teamId, profileId } },
      select: { teamId: true, profileId: true },
    })
    return membership
  }

  async deleteTeamMembership(teamId: string, profileId: string): Promise<void> {
    await prisma.teamMember.delete({
      where: { teamId_profileId: { teamId, profileId } },
    })
  }

  async deleteTeamMembershipWithAudit(input: {
    teamId: string
    profileId: string
    actorProfileId: string
  }): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.teamMember.delete({
        where: { teamId_profileId: { teamId: input.teamId, profileId: input.profileId } },
      })
      await tx.backofficeDeletionAuditLog.create({
        data: {
          entityType: "TEAM_MEMBERSHIP",
          entityId: input.profileId,
          action: "remove_from_team",
          actorProfileId: input.actorProfileId,
          payload: { teamId: input.teamId, profileId: input.profileId },
        },
      })
    })
  }

  async findTeamForMaster(
    teamId: string,
    masterId: string
  ): Promise<{ id: string; masterId: string } | null> {
    return prisma.team.findFirst({
      where: { id: teamId, masterId },
      select: { id: true, masterId: true },
    })
  }

  async findTeamById(teamId: string): Promise<{ id: string; masterId: string } | null> {
    return prisma.team.findFirst({
      where: { id: teamId, deletedAt: null },
      select: { id: true, masterId: true },
    })
  }

  async findProfileRoleContext(profileId: string): Promise<MemberProfileRoleContext | null> {
    const profile = await prisma.profile.findUnique({
      where: { id: profileId },
      select: {
        id: true,
        role: true,
        functions: true,
        managerId: true,
        isMaster: true,
      },
    })
    if (!profile) return null
    return {
      id: profile.id,
      role: profile.role,
      functions: profile.functions,
      managerId: profile.managerId,
      isMaster: profile.isMaster,
    }
  }

  async findAccountMembershipTemplate(
    profileId: string,
    masterId: string
  ): Promise<MemberAccountMembershipTemplate | null> {
    const membership = await prisma.teamMember.findFirst({
      where: {
        profileId,
        team: { masterId },
      },
      orderBy: { createdAt: "asc" },
      select: {
        role: true,
        functions: true,
        canCreateAccountUsers: true,
        canManageAccountTeams: true,
        canTransferAccountLeads: true,
        canViewAllTeams: true,
      },
    })
    if (!membership) return null
    return {
      role: membership.role,
      functions: membership.functions,
      canCreateAccountUsers: membership.canCreateAccountUsers,
      canManageAccountTeams: membership.canManageAccountTeams,
      canTransferAccountLeads: membership.canTransferAccountLeads,
      canViewAllTeams: membership.canViewAllTeams,
    }
  }

  async createTeamMembership(input: {
    teamId: string
    profileId: string
    role: string
    functions: string[]
    canCreateAccountUsers: boolean
    canManageAccountTeams: boolean
    canTransferAccountLeads: boolean
    canViewAllTeams?: boolean
  }): Promise<{ id: string }> {
    const teamMember = await prisma.teamMember.create({
      data: {
        teamId: input.teamId,
        profileId: input.profileId,
        role: input.role as UserRole,
        functions: input.functions as UserFunction[],
        canCreateAccountUsers: input.canCreateAccountUsers,
        canManageAccountTeams: input.canManageAccountTeams,
        canTransferAccountLeads: input.canTransferAccountLeads,
        canViewAllTeams: input.canViewAllTeams ?? false,
      },
      select: { id: true },
    })
    return teamMember
  }

  async findAccountTeamMemberships(
    profileId: string,
    masterId: string
  ): Promise<MemberAccountTeamMembershipItem[]> {
    const teams = await prisma.team.findMany({
      where: { masterId },
      select: {
        id: true,
        name: true,
        _count: { select: { members: true } },
        members: {
          where: { profileId },
          select: {
            role: true,
            functions: true,
            canCreateAccountUsers: true,
            canManageAccountTeams: true,
            canTransferAccountLeads: true,
            canViewAllTeams: true,
          },
        },
      },
      orderBy: { name: "asc" },
    })

    return teams.map((team) => {
      const membership = team.members[0]
      const isMember = Boolean(membership)

      if (!isMember) {
        return {
          teamId: team.id,
          teamName: team.name,
          membersCount: team._count.members,
          isMember: false,
        }
      }

      return {
        teamId: team.id,
        teamName: team.name,
        membersCount: team._count.members,
        isMember: true,
        role: membership.role,
        functions: membership.functions,
        canCreateAccountUsers: membership.canCreateAccountUsers,
        canManageAccountTeams: membership.canManageAccountTeams,
        canTransferAccountLeads: membership.canTransferAccountLeads,
        canViewAllTeams: membership.canViewAllTeams,
      }
    })
  }

  async updateTeamMemberAccess(
    profileId: string,
    teamId: string,
    data: {
      role?: string
      functions?: string[]
      canCreateAccountUsers?: boolean
      canManageAccountTeams?: boolean
      canTransferAccountLeads?: boolean
      canViewAllTeams?: boolean
    }
  ): Promise<void> {
    const payload: Record<string, unknown> = {}
    if (data.role !== undefined) payload.role = data.role as UserRole
    if (data.functions !== undefined) payload.functions = data.functions as UserFunction[]
    if (data.canCreateAccountUsers !== undefined) {
      payload.canCreateAccountUsers = data.canCreateAccountUsers
    }
    if (data.canManageAccountTeams !== undefined) {
      payload.canManageAccountTeams = data.canManageAccountTeams
    }
    if (data.canTransferAccountLeads !== undefined) {
      payload.canTransferAccountLeads = data.canTransferAccountLeads
    }
    if (data.canViewAllTeams !== undefined) {
      payload.canViewAllTeams = data.canViewAllTeams
    }

    if (Object.keys(payload).length === 0) return

    await prisma.teamMember.updateMany({
      where: { profileId, teamId },
      data: payload,
    })
  }

  async updateAccountMemberAccess(
    profileId: string,
    masterId: string,
    data: {
      role?: string
      functions?: string[]
      canCreateAccountUsers?: boolean
      canManageAccountTeams?: boolean
      canTransferAccountLeads?: boolean
      canViewAllTeams?: boolean
    }
  ): Promise<void> {
    const payload: Record<string, unknown> = {}
    if (data.role !== undefined) payload.role = data.role as UserRole
    if (data.functions !== undefined) payload.functions = data.functions as UserFunction[]
    if (data.canCreateAccountUsers !== undefined) {
      payload.canCreateAccountUsers = data.canCreateAccountUsers
    }
    if (data.canManageAccountTeams !== undefined) {
      payload.canManageAccountTeams = data.canManageAccountTeams
    }
    if (data.canTransferAccountLeads !== undefined) {
      payload.canTransferAccountLeads = data.canTransferAccountLeads
    }
    if (data.canViewAllTeams !== undefined) {
      payload.canViewAllTeams = data.canViewAllTeams
    }

    if (Object.keys(payload).length === 0) return

    await prisma.teamMember.updateMany({
      where: { profileId, team: { masterId } },
      data: payload,
    })
  }

  async findExternalTeamMemberships(profileId: string, excludeMasterId: string) {
    const memberships = await prisma.teamMember.findMany({
      where: {
        profileId,
        team: {
          masterId: { not: excludeMasterId },
        },
      },
      select: {
        role: true,
        team: {
          select: {
            id: true,
            name: true,
            masterId: true,
            master: {
              select: {
                fullName: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return memberships.map((membership) => ({
      teamId: membership.team.id,
      teamName: membership.team.name,
      accountMasterId: membership.team.masterId,
      accountName:
        membership.team.master.fullName ?? membership.team.master.email ?? "Conta externa",
      role: membership.role,
    }))
  }
}
