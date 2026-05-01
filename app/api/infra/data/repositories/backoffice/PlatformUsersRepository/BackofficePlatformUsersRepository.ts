import { prisma } from "@/app/api/infra/data/prisma"
import type { Prisma } from "@prisma/client"
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
    const normalizedName = filters?.name?.trim()
    const normalizedEmail = filters?.email?.trim()
    const normalizedTeam = filters?.team?.trim()

    const andFilters: Prisma.ProfileWhereInput[] = []

    if (normalizedEmail) {
      andFilters.push({
        OR: [
          { email: { contains: normalizedEmail, mode: "insensitive" } },
          {
            operators: {
              some: {
                email: { contains: normalizedEmail, mode: "insensitive" },
              },
            },
          },
          {
            teamsOwned: {
              some: {
                members: {
                  some: {
                    profile: {
                      email: { contains: normalizedEmail, mode: "insensitive" },
                    },
                  },
                },
              },
            },
          },
        ],
      })
    }

    if (normalizedTeam) {
      andFilters.push({
        teamsOwned: {
          some: {
            name: { contains: normalizedTeam, mode: "insensitive" },
          },
        },
      })
    }

    return {
      isMaster: true,
      role: "manager",
      ...(normalizedName
        ? {
            OR: [
              { fullName: { contains: normalizedName, mode: "insensitive" } },
              {
                operators: {
                  some: {
                    fullName: { contains: normalizedName, mode: "insensitive" },
                  },
                },
              },
              {
                teamsOwned: {
                  some: {
                    members: {
                      some: {
                        profile: {
                          fullName: { contains: normalizedName, mode: "insensitive" },
                        },
                      },
                    },
                  },
                },
              },
            ],
          }
        : {}),
      ...(andFilters.length > 0 ? { AND: andFilters } : {}),
    }
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
        operatorCount: true,
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
                  fullName: true,
                  email: true,
                  phone: true,
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
      operatorCount: master.operatorCount,
      linkedUsersCount: linkedUsers.size,
      teamsTotalItems,
      teams: teams.map((team) => ({
        id: team.id,
        name: team.name,
        createdAt: team.createdAt,
        membersCount: team._count.members,
        members: team.members.map((member) => ({
          id: member.profile.id,
          fullName: member.profile.fullName,
          email: member.profile.email,
          phone: member.profile.phone,
          addedAt: member.createdAt,
          role: member.role,
          functions: member.functions,
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
}
