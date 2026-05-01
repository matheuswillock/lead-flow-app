import { prisma } from "@/app/api/infra/data/prisma"
import type { Prisma } from "@prisma/client"
import type {
  IBackofficePlatformUsersRepository,
  MasterPlatformUserBillingRecord,
  MasterPlatformUserRecord,
  MasterPlatformUserDetailsRecord,
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
}
