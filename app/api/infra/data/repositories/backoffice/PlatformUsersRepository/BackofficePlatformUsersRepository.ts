import { prisma } from "@/app/api/infra/data/prisma"
import type { Prisma, UserRole, UserFunction } from "@prisma/client"
import { isGoogleConnectionActive } from "@/lib/google/connection"
import type {
  IBackofficePlatformUsersRepository,
  MasterPlatformUserBillingRecord,
  MasterPlatformUserRecord,
  MasterPlatformUserDetailsRecord,
  MasterUserForDeletionRecord,
  PlatformUsersFilters,
  RepositoryPaginatedResult,
  RepositoryPaginationParams,
} from "./IBackofficePlatformUsersRepository"

export class BackofficePlatformUsersRepository implements IBackofficePlatformUsersRepository {
  private buildMasterFilters(filters?: PlatformUsersFilters): Prisma.ProfileWhereInput {
    // When the API receives a single query string it sets name=email=team to the same value.
    // Merge all three into one unified search term so we never AND them together
    // (which would require a record to match name AND email AND team simultaneously).
    const q = (filters?.name ?? filters?.email ?? filters?.team ?? "").trim()
    const normalizedTeam = filters?.team?.trim()

    const base: Prisma.ProfileWhereInput = { isMaster: true, role: "manager" }

    const andClauses: Prisma.ProfileWhereInput[] = []

    if (q || normalizedTeam) {
      const orClauses: Prisma.ProfileWhereInput[] = []

      if (q) {
        orClauses.push(
          { fullName: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          {
            operators: {
              some: {
                OR: [
                  { fullName: { contains: q, mode: "insensitive" } },
                  { email: { contains: q, mode: "insensitive" } },
                ],
              },
            },
          },
          {
            teamsOwned: {
              some: {
                members: {
                  some: {
                    profile: {
                      OR: [
                        { fullName: { contains: q, mode: "insensitive" } },
                        { email: { contains: q, mode: "insensitive" } },
                      ],
                    },
                  },
                },
              },
            },
          }
        )
      }

      if (normalizedTeam && normalizedTeam !== q) {
        orClauses.push({
          teamsOwned: {
            some: { name: { contains: normalizedTeam, mode: "insensitive" } },
          },
        })
      }

      if (orClauses.length > 0) {
        andClauses.push({ OR: orClauses })
      }
    }

    if (filters?.plan) {
      const plan = filters.plan
      if (plan === "lifetime") {
        andClauses.push({ hasPermanentSubscription: true })
      } else if (plan === "trial") {
        andClauses.push({
          hasPermanentSubscription: false,
          subscription: { is: { subscriptionPlan: "free_trial" } },
        })
      } else if (plan === "monthly") {
        andClauses.push({
          hasPermanentSubscription: false,
          subscription: { is: { subscriptionPlan: { in: ["manager_base", "with_operators"] } } },
        })
      } else if (plan === "none") {
        andClauses.push({
          hasPermanentSubscription: false,
          subscription: { is: null },
        })
      }
    }

    if (filters?.userType) {
      if (filters.userType === "member_pro") {
        andClauses.push({
          userTypeAssignment: {
            is: { userType: { is: { slug: "member_pro" } } },
          },
        })
      } else {
        andClauses.push({
          OR: [
            { userTypeAssignment: { is: null } },
            {
              userTypeAssignment: {
                is: { userType: { is: { slug: "common" } } },
              },
            },
          ],
        })
      }
    }

    return andClauses.length > 0
      ? { ...base, AND: andClauses }
      : base
  }

  async findMasterUsersWithFilters(
    filters: PlatformUsersFilters | undefined,
    pagination: RepositoryPaginationParams
  ): Promise<RepositoryPaginatedResult<MasterPlatformUserRecord>> {
    const skip = (pagination.page - 1) * pagination.pageSize
    const where = this.buildMasterFilters(filters)

    const [masters, totalItems] = await Promise.all([
      prisma.profile.findMany({
        where,
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          profileIconUrl: true,
          createdAt: true,
          hasPermanentSubscription: true,
          subscriptionPlan: true,
          operatorCount: true,
          googleConnection: {
            select: {
              refreshToken: true,
              revokedAt: true,
            },
          },
          teamsOwned: {
            select: {
              id: true,
              name: true,
              createdAt: true,
              _count: {
                select: {
                  members: true,
                },
              },
            },
            orderBy: { createdAt: "desc" },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: pagination.pageSize,
      }),
      prisma.profile.count({ where }),
    ])

    const masterIds = masters.map((master) => master.id)
    const membersByMaster = new Map<string, Set<string>>()

    masterIds.forEach((masterId) => {
      membersByMaster.set(masterId, new Set<string>())
    })

    if (masterIds.length > 0) {
      const memberships = await prisma.teamMember.findMany({
        where: {
          team: {
            masterId: { in: masterIds },
          },
        },
        select: {
          profileId: true,
          team: {
            select: {
              masterId: true,
            },
          },
        },
      })

      memberships.forEach((membership) => {
        const masterId = membership.team.masterId
        if (membership.profileId === masterId) {
          return
        }

        const set = membersByMaster.get(masterId)
        if (set) {
          set.add(membership.profileId)
        }
      })
    }

    const items = masters.map((master) => ({
      id: master.id,
      fullName: master.fullName,
      email: master.email,
      phone: master.phone,
      profileIconUrl: master.profileIconUrl,
      createdAt: master.createdAt,
      hasPermanentSubscription: master.hasPermanentSubscription,
      subscriptionPlan: master.subscriptionPlan,
      operatorCount: master.operatorCount,
      googleCalendarConnected: isGoogleConnectionActive(master.googleConnection),
      linkedUsersCount: membersByMaster.get(master.id)?.size ?? 0,
      teamsCount: master.teamsOwned.length,
      teams: master.teamsOwned.map((team) => ({
        id: team.id,
        name: team.name,
        createdAt: team.createdAt,
        membersCount: team._count.members,
      })),
    }))

    return {
      items,
      totalItems,
    }
  }

  async findMasterUserDetailsById(
    masterProfileId: string,
    options: {
      query?: string
      page: number
      pageSize: number
    }
  ): Promise<MasterPlatformUserDetailsRecord | null> {
    const master = await prisma.profile.findFirst({
      where: {
        id: masterProfileId,
        isMaster: true,
        role: "manager",
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        cpfCnpj: true,
        postalCode: true,
        address: true,
        addressNumber: true,
        neighborhood: true,
        complement: true,
        city: true,
        state: true,
        functions: true,
        profileIconUrl: true,
        createdAt: true,
        hasPermanentSubscription: true,
        subscriptionPlan: true,
        subscriptionStatus: true,
        subscriptionId: true,
        operatorCount: true,
        googleConnection: {
          select: {
            refreshToken: true,
            revokedAt: true,
          },
        },
      },
    })

    if (!master) {
      return null
    }

    const normalizedQuery = options.query?.trim()
    const teamsWhere: Prisma.TeamWhereInput = {
      masterId: master.id,
      ...(normalizedQuery
        ? {
            OR: [
              {
                name: {
                  contains: normalizedQuery,
                  mode: "insensitive",
                },
              },
              {
                members: {
                  some: {
                    profile: {
                      fullName: {
                        contains: normalizedQuery,
                        mode: "insensitive",
                      },
                    },
                  },
                },
              },
              {
                members: {
                  some: {
                    profile: {
                      email: {
                        contains: normalizedQuery,
                        mode: "insensitive",
                      },
                    },
                  },
                },
              },
            ],
          }
        : {}),
    }

    const skip = (options.page - 1) * options.pageSize

    const [teams, teamsTotalItems, memberships] = await Promise.all([
      prisma.team.findMany({
        where: teamsWhere,
        select: {
          id: true,
          name: true,
          createdAt: true,
          _count: {
            select: {
              members: true,
            },
          },
          members: {
            select: {
              id: true,
              role: true,
              functions: true,
              createdAt: true,
              profile: {
                select: {
                  id: true,
                  supabaseId: true,
                  fullName: true,
                  email: true,
                  phone: true,
                  googleConnection: {
                    select: {
                      googleEmail: true,
                      refreshToken: true,
                      revokedAt: true,
                    },
                  },
                  isMaster: true,
                  canCreateAccountUsers: true,
                  canManageAccountTeams: true,
                },
              },
            },
            orderBy: { createdAt: "desc" },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: options.pageSize,
      }),
      prisma.team.count({ where: teamsWhere }),
      prisma.teamMember.findMany({
        where: {
          team: {
            masterId: master.id,
          },
        },
        select: {
          profileId: true,
        },
      }),
    ])

    const linkedUsers = new Set<string>()
    memberships.forEach((membership) => {
      if (membership.profileId !== master.id) {
        linkedUsers.add(membership.profileId)
      }
    })

    return {
      id: master.id,
      fullName: master.fullName,
      email: master.email,
      phone: master.phone,
      cpfCnpj: master.cpfCnpj,
      postalCode: master.postalCode,
      address: master.address,
      addressNumber: master.addressNumber,
      neighborhood: master.neighborhood,
      complement: master.complement,
      city: master.city,
      state: master.state,
      functions: master.functions,
      profileIconUrl: master.profileIconUrl,
      createdAt: master.createdAt,
      hasPermanentSubscription: master.hasPermanentSubscription,
      subscriptionPlan: master.subscriptionPlan,
      subscriptionStatus: master.subscriptionStatus,
      subscriptionId: master.subscriptionId,
      operatorCount: master.operatorCount,
      googleCalendarConnected: isGoogleConnectionActive(master.googleConnection),
      linkedUsersCount: linkedUsers.size,
      teamsTotalItems,
      teams: teams.map((team) => ({
        id: team.id,
        name: team.name,
        createdAt: team.createdAt,
        membersCount: team._count.members,
        members: team.members.map((member) => ({
          id: member.profile.id,
          supabaseId: member.profile.supabaseId,
          fullName: member.profile.fullName,
          email: member.profile.email,
          phone: member.profile.phone,
          addedAt: member.createdAt,
          role: member.role,
          googleCalendarConnected: isGoogleConnectionActive(member.profile.googleConnection),
          googleEmail: member.profile.googleConnection?.googleEmail ?? null,
          functions: member.functions,
          isMaster: member.profile.isMaster,
          canCreateAccountUsers: member.profile.canCreateAccountUsers,
          canManageAccountTeams: member.profile.canManageAccountTeams,
        })),
      })),
    }
  }

  async findMasterUserBillingById(
    masterProfileId: string
  ): Promise<MasterPlatformUserBillingRecord | null> {
    return prisma.profile.findFirst({
      where: {
        id: masterProfileId,
        isMaster: true,
        role: "manager",
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        asaasCustomerId: true,
        hasPermanentSubscription: true,
      },
    })
  }

  async updateMasterUserProfile(
    masterProfileId: string,
    data: {
      fullName?: string
      phone?: string | null
      cpfCnpj?: string | null
      postalCode?: string | null
      address?: string | null
      addressNumber?: string | null
      neighborhood?: string | null
      complement?: string | null
      city?: string | null
      state?: string | null
      functions?: string[]
      hasPermanentSubscription?: boolean
    }
  ): Promise<{ id: string } | null> {
    try {
      const updateData: Record<string, unknown> = {}
      if (data.fullName !== undefined) updateData.fullName = data.fullName
      if (data.phone !== undefined) updateData.phone = data.phone
      if (data.cpfCnpj !== undefined) updateData.cpfCnpj = data.cpfCnpj
      if (data.postalCode !== undefined) updateData.postalCode = data.postalCode
      if (data.address !== undefined) updateData.address = data.address
      if (data.addressNumber !== undefined) updateData.addressNumber = data.addressNumber
      if (data.neighborhood !== undefined) updateData.neighborhood = data.neighborhood
      if (data.complement !== undefined) updateData.complement = data.complement
      if (data.city !== undefined) updateData.city = data.city
      if (data.state !== undefined) updateData.state = data.state
      if (data.functions !== undefined) updateData.functions = data.functions
      if (data.hasPermanentSubscription !== undefined) updateData.hasPermanentSubscription = data.hasPermanentSubscription

      if (Object.keys(updateData).length === 0) return null

      return await prisma.profile.update({
        where: {
          id: masterProfileId,
          isMaster: true,
          role: "manager",
        },
        data: updateData,
        select: { id: true },
      })
    } catch {
      return null
    }
  }

  async findMasterUserForDeletion(masterProfileId: string): Promise<MasterUserForDeletionRecord | null> {
    const master = await prisma.profile.findFirst({
      where: {
        id: masterProfileId,
        isMaster: true,
        role: "manager",
      },
      select: {
        id: true,
        supabaseId: true,
        fullName: true,
        email: true,
      },
    })

    if (!master) return null

    const managerMemberships = await prisma.teamMember.findMany({
      where: {
        team: { masterId: masterProfileId },
        role: "manager",
        profileId: { not: masterProfileId },
      },
      select: {
        profileId: true,
        profile: {
          select: {
            fullName: true,
            email: true,
          },
        },
      },
      distinct: ["profileId"],
    })

    return {
      id: master.id,
      supabaseId: master.supabaseId,
      fullName: master.fullName,
      email: master.email,
      managers: managerMemberships.map((m) => ({
        fullName: m.profile.fullName,
        email: m.profile.email,
      })),
    }
  }

  async deleteMasterUserWithAllMembers(masterProfileId: string): Promise<{
    masterSupabaseId: string | null
    memberSupabaseIds: string[]
  }> {
    const result: { masterSupabaseId: string | null; memberSupabaseIds: string[] } = {
      masterSupabaseId: null,
      memberSupabaseIds: [],
    }

    await prisma.$transaction(async (tx) => {
      const master = await tx.profile.findFirst({
        where: { id: masterProfileId, isMaster: true, role: "manager" },
        select: { id: true, supabaseId: true },
      })

      if (!master) return

      result.masterSupabaseId = master.supabaseId

      const memberships = await tx.teamMember.findMany({
        where: {
          team: { masterId: masterProfileId },
          profileId: { not: masterProfileId },
        },
        select: {
          profileId: true,
          profile: { select: { supabaseId: true } },
        },
        distinct: ["profileId"],
      })

      const memberProfileIds = memberships.map((m) => m.profileId)
      result.memberSupabaseIds = memberships
        .map((m) => m.profile.supabaseId)
        .filter((id): id is string => id !== null)

      const allProfileIds = [masterProfileId, ...memberProfileIds]

      await tx.profile.updateMany({
        where: { managerId: { in: allProfileIds } },
        data: { managerId: null },
      })

      await tx.teamMember.deleteMany({
        where: { team: { masterId: masterProfileId } },
      })

      if (memberProfileIds.length > 0) {
        await tx.profile.deleteMany({
          where: { id: { in: memberProfileIds } },
        })
      }

      if (master.supabaseId) {
        await tx.profile.delete({ where: { supabaseId: master.supabaseId } })
      } else {
        await tx.profile.delete({ where: { id: masterProfileId } })
      }
    })

    return result
  }

  async findDefaultTeamByMasterId(masterProfileId: string): Promise<{ id: string; name: string } | null> {
    const team = await prisma.team.findFirst({
      where: { masterId: masterProfileId, isDefault: true },
      select: { id: true, name: true },
    })
    if (team) return team

    return prisma.team.findFirst({
      where: { masterId: masterProfileId },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true },
    })
  }

  async findTeamByIdAndMasterId(teamId: string, masterId: string): Promise<{ id: string } | null> {
    return prisma.team.findFirst({
      where: { id: teamId, masterId },
      select: { id: true },
    })
  }

  async findProfileByEmail(email: string): Promise<{ id: string; isMaster: boolean; managerId: string | null } | null> {
    return prisma.profile.findUnique({
      where: { email },
      select: { id: true, isMaster: true, managerId: true },
    })
  }

  async createMemberForMaster(
    masterProfileId: string,
    data: {
      fullName: string
      email: string
      phone?: string | null
      role: "manager" | "backoffice" | "operator"
      functions: ("SDR" | "CLOSER")[]
      canCreateAccountUsers?: boolean
      canManageAccountTeams?: boolean
    },
    teamId: string
  ): Promise<{ profileId: string; teamMemberId: string }> {
    return prisma.$transaction(async (tx) => {
      const profile = await tx.profile.create({
        data: {
          fullName: data.fullName,
          email: data.email,
          phone: data.phone ?? null,
          role: data.role as UserRole,
          functions: data.functions as UserFunction[],
          managerId: masterProfileId,
          isMaster: false,
          canCreateAccountUsers: data.canCreateAccountUsers ?? false,
          canManageAccountTeams: data.canManageAccountTeams ?? false,
        },
        select: { id: true },
      })

      const teamMember = await tx.teamMember.create({
        data: {
          teamId,
          profileId: profile.id,
          role: data.role as UserRole,
          functions: data.functions as UserFunction[],
        },
        select: { id: true },
      })

      return { profileId: profile.id, teamMemberId: teamMember.id }
    })
  }

  async addExistingProfileToTeam(
    profileId: string,
    teamId: string,
    role: "manager" | "backoffice" | "operator",
    functions: ("SDR" | "CLOSER")[],
    permissions?: { canCreateAccountUsers: boolean; canManageAccountTeams: boolean }
  ): Promise<{ teamMemberId: string }> {
    return prisma.$transaction(async (tx) => {
      if (permissions) {
        await tx.profile.update({
          where: { id: profileId },
          data: {
            canCreateAccountUsers: permissions.canCreateAccountUsers,
            canManageAccountTeams: permissions.canManageAccountTeams,
          },
        })
      }

      const teamMember = await tx.teamMember.create({
        data: { profileId, teamId, role: role as UserRole, functions: functions as UserFunction[] },
        select: { id: true },
      })

      return { teamMemberId: teamMember.id }
    })
  }

  async createTeamForMaster(masterProfileId: string, name: string): Promise<{ id: string; name: string }> {
    return prisma.$transaction(async (tx) => {
      const team = await tx.team.create({
        data: { name, masterId: masterProfileId, isDefault: false },
        select: { id: true, name: true },
      })

      await tx.teamMember.create({
        data: {
          teamId: team.id,
          profileId: masterProfileId,
          role: "manager" as UserRole,
          functions: [],
        },
      })

      return team
    })
  }

  async updateTeam(
    teamId: string,
    masterId: string,
    data: { name: string }
  ): Promise<{ id: string } | null> {
    try {
      return await prisma.team.update({
        where: { id: teamId, masterId },
        data: { name: data.name },
        select: { id: true },
      })
    } catch {
      return null
    }
  }

  async deleteTeam(teamId: string, masterId: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.teamMember.deleteMany({ where: { teamId } })
      await tx.team.delete({ where: { id: teamId, masterId } })
    })
  }

  async updateSupabaseIdForProfile(profileId: string, supabaseId: string): Promise<void> {
    await prisma.profile.update({
      where: { id: profileId },
      data: { supabaseId },
    })
  }
}
