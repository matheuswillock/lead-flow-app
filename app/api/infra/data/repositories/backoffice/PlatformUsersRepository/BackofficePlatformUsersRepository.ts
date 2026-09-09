import { prisma } from "@/app/api/infra/data/prisma"
import type { Prisma, UserRole, UserFunction } from "@prisma/client"
import { subscriptionCreditRepository } from "@/app/api/infra/data/repositories/billing/SubscriptionCreditRepository"
import { isGoogleConnectionActive } from "@/lib/google/connection"
import { isActiveMemberProAssignment } from "@/app/api/shared/billing/memberProBillingRules"
import { toBillingCycle } from "@/lib/billing/resolvePrice"
import type {
  IBackofficePlatformUsersRepository,
  MasterPlatformUserBillingRecord,
  MasterPlatformUserRecord,
  MasterPlatformUserDetailsRecord,
  MasterPlatformUserPlanSubscriptionRecord,
  MasterUserForDeletionRecord,
  PlatformUsersFilters,
  RepositoryPaginatedResult,
  RepositoryPaginationParams,
} from "./IBackofficePlatformUsersRepository"

const PLAN_SUBSCRIPTION_SELECT = {
  subscriptionCycle: true,
  product: {
    select: {
      name: true,
      priceMonthly: true,
      priceQuarterly: true,
      priceQuadrimester: true,
      priceSemiannual: true,
      priceAnnual: true,
    },
  },
  adhesion: {
    select: {
      cycle: true,
      totalAmount: true,
      negotiatedTotalAmount: true,
    },
  },
} satisfies Prisma.ProfileSubscriptionSelect

type PlanSubscriptionQueryResult = Prisma.ProfileSubscriptionGetPayload<{
  select: typeof PLAN_SUBSCRIPTION_SELECT
}>

function decimalToNumber(value: { toString(): string } | null | undefined): number | null {
  if (value === null || value === undefined) return null
  return Number(value.toString())
}

function getProductListAmountForCycle(
  product: PlanSubscriptionQueryResult["product"],
  cycle: string | null
): number | null {
  if (!product || !cycle) return null
  switch (cycle) {
    case "monthly":
      return decimalToNumber(product.priceMonthly)
    case "quarterly":
      return decimalToNumber(product.priceQuarterly)
    case "quadrimester":
      return decimalToNumber(product.priceQuadrimester)
    case "semiannual":
      return decimalToNumber(product.priceSemiannual)
    case "annual":
      return decimalToNumber(product.priceAnnual)
    default:
      return null
  }
}

/**
 * E5 (§7.7): dado real do plano — nunca preço hardcoded por enum. Ciclo
 * preferencial vem da adesão (fonte da venda); `subscriptionCycle` legado
 * só cobre o caso sem adesão vinculada.
 */
export function mapPlanSubscription(
  subscription: PlanSubscriptionQueryResult | null
): MasterPlatformUserPlanSubscriptionRecord | null {
  if (!subscription) return null

  const cycle =
    subscription.adhesion?.cycle ?? toBillingCycle(subscription.subscriptionCycle ?? "") ?? null
  const chargedAmount = subscription.adhesion
    ? decimalToNumber(subscription.adhesion.negotiatedTotalAmount ?? subscription.adhesion.totalAmount)
    : null
  const productName = subscription.product?.name ?? null
  const listAmount = getProductListAmountForCycle(subscription.product, cycle)

  if (!productName && chargedAmount === null) return null

  return { productName, cycle, chargedAmount, listAmount }
}

function mapMasterUserType(
  assignment: { accessExpiresAt: Date | null; userType: { slug: string } } | null
): MasterPlatformUserDetailsRecord["userType"] {
  const slug: "common" | "member_pro" =
    assignment?.userType.slug === "member_pro" ? "member_pro" : "common"
  const accessExpiresAt = assignment?.accessExpiresAt ?? null
  const isExpired =
    slug === "member_pro" &&
    accessExpiresAt !== null &&
    new Date(accessExpiresAt).getTime() <= Date.now()

  return {
    slug,
    isExpired,
    accessExpiresAt: accessExpiresAt ? accessExpiresAt.toISOString() : null,
  }
}

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
          hasUnlimitedUsers: true,
          multiskillEnabled: true,
          subscriptionPlan: true,
          subscription: { select: PLAN_SUBSCRIPTION_SELECT },
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
      hasUnlimitedUsers: master.hasUnlimitedUsers,
      multiskillEnabled: master.multiskillEnabled,
      subscriptionPlan: master.subscriptionPlan,
      planSubscription: mapPlanSubscription(master.subscription),
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
        supabaseId: true,
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
        hasUnlimitedUsers: true,
        multiskillEnabled: true,
        subscriptionPlan: true,
        subscriptionStatus: true,
        subscriptionId: true,
        subscription: { select: PLAN_SUBSCRIPTION_SELECT },
        operatorCount: true,
        googleConnection: {
          select: {
            refreshToken: true,
            revokedAt: true,
          },
        },
        userTypeAssignment: {
          select: {
            accessExpiresAt: true,
            userType: { select: { slug: true } },
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

    const [teams, teamsTotalItems, allTeams, memberships] = await Promise.all([
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
              canCreateAccountUsers: true,
              canManageAccountTeams: true,
              canTransferAccountLeads: true,
              canViewAllTeams: true,
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
                },
              },
            },
            orderBy: { createdAt: "desc" },
          },
          transferRoutesFrom: {
            select: {
              targetTeamId: true,
              targetTeam: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: options.pageSize,
      }),
      prisma.team.count({ where: teamsWhere }),
      prisma.team.findMany({
        where: { masterId: master.id },
        select: {
          id: true,
          name: true,
          _count: { select: { members: true } },
        },
        orderBy: { name: "asc" },
      }),
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
      supabaseId: master.supabaseId,
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
      hasUnlimitedUsers: master.hasUnlimitedUsers,
      multiskillEnabled: master.multiskillEnabled,
      subscriptionPlan: master.subscriptionPlan,
      subscriptionStatus: master.subscriptionStatus,
      subscriptionId: master.subscriptionId,
      planSubscription: mapPlanSubscription(master.subscription),
      operatorCount: master.operatorCount,
      googleCalendarConnected: isGoogleConnectionActive(master.googleConnection),
      linkedUsersCount: linkedUsers.size,
      teamsTotalItems,
      userType: mapMasterUserType(master.userTypeAssignment),
      allTeams: allTeams.map((team) => ({
        id: team.id,
        name: team.name,
        membersCount: team._count.members,
      })),
      teams: teams.map((team) => ({
        id: team.id,
        name: team.name,
        createdAt: team.createdAt,
        membersCount: team._count.members,
        members: team.members.map((member) => ({
          id: member.profile.id,
          teamMemberId: member.id,
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
          canCreateAccountUsers: member.canCreateAccountUsers,
          canManageAccountTeams: member.canManageAccountTeams,
          canTransferAccountLeads: member.canTransferAccountLeads,
          canViewAllTeams: member.canViewAllTeams,
        })),
        transferRoutes: team.transferRoutesFrom.map((r) => ({
          teamId: r.targetTeamId,
          teamName: r.targetTeam.name,
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
        cpfCnpj: true,
        phone: true,
        postalCode: true,
        address: true,
        addressNumber: true,
        neighborhood: true,
        complement: true,
        asaasCustomerId: true,
        asaasCustomerAccount: true,
        asaasSubscriptionId: true,
        subscriptionStatus: true,
        subscriptionNextDueDate: true,
        subscriptionEndDate: true,
        subscriptionCycle: true,
        hasPermanentSubscription: true,
        hasUnlimitedUsers: true,
        timezone: true,
        functions: true,
      },
    })
  }

  async profileBelongsToMasterAccount(
    profileId: string,
    masterProfileId: string
  ): Promise<boolean> {
    const profile = await prisma.profile.findUnique({
      where: { id: profileId },
      select: { managerId: true },
    })

    if (!profile) {
      return false
    }

    if (profile.managerId === masterProfileId) {
      return true
    }

    const membership = await prisma.teamMember.findFirst({
      where: {
        profileId,
        team: { masterId: masterProfileId },
      },
      select: { id: true },
    })

    return membership !== null
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
      hasUnlimitedUsers?: boolean
      multiskillEnabled?: boolean
    }
  ): Promise<{ id: string; hasUnlimitedUsers: boolean } | null> {
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
      if (data.hasPermanentSubscription !== undefined) {
        updateData.hasPermanentSubscription = data.hasPermanentSubscription
        // Vitalício concede usuários ilimitados.
        if (data.hasPermanentSubscription === true) {
          updateData.hasUnlimitedUsers = true
        } else if (data.hasUnlimitedUsers === undefined) {
          // Sem grant explícito nesta requisição: recalcula com base em outras fontes
          // (adesão anual paga, Member PRO ativo, assinatura YEARLY ativa) em vez de manter a flag antiga.
          updateData.hasUnlimitedUsers = await this.hasOtherUnlimitedUsersGrant(masterProfileId)
        }
      }
      if (data.hasUnlimitedUsers !== undefined) updateData.hasUnlimitedUsers = data.hasUnlimitedUsers
      if (data.multiskillEnabled !== undefined) updateData.multiskillEnabled = data.multiskillEnabled

      if (Object.keys(updateData).length === 0) return null

      return await prisma.profile.update({
        where: {
          id: masterProfileId,
          isMaster: true,
          role: "manager",
        },
        data: updateData,
        select: { id: true, hasUnlimitedUsers: true },
      })
    } catch {
      return null
    }
  }

  private async hasOtherUnlimitedUsersGrant(masterProfileId: string): Promise<boolean> {
    const [annualAdhesionCount, userTypeAssignment, profileSubscription] = await Promise.all([
      prisma.backofficeAdhesion.count({
        where: {
          createdProfileId: masterProfileId,
          status: "paid",
          cycle: "annual",
        },
      }),
      prisma.profileUserTypeAssignment.findUnique({
        where: { profileId: masterProfileId },
        select: {
          accessExpiresAt: true,
          userType: { select: { slug: true } },
        },
      }),
      prisma.profileSubscription.findUnique({
        where: { profileId: masterProfileId },
        select: {
          subscriptionCycle: true,
          subscriptionStatus: true,
          subscriptionStartDate: true,
          subscriptionEndDate: true,
        },
      }),
    ])

    if (annualAdhesionCount > 0) {
      return true
    }

    if (isActiveMemberProAssignment(
      userTypeAssignment
        ? { slug: userTypeAssignment.userType.slug, accessExpiresAt: userTypeAssignment.accessExpiresAt }
        : null
    )) {
      return true
    }

    // Mesma regra usada pelo backfill: assinatura anual ativa dentro da janela concede ilimitado.
    const now = new Date()
    const isYearlyCycle = profileSubscription?.subscriptionCycle === "YEARLY"
    const isActiveSubscriptionStatus =
      !profileSubscription?.subscriptionStatus || profileSubscription.subscriptionStatus === "active"
    const isWithinSubscriptionWindow =
      (!profileSubscription?.subscriptionStartDate || profileSubscription.subscriptionStartDate <= now) &&
      (!profileSubscription?.subscriptionEndDate || profileSubscription.subscriptionEndDate >= now)

    return isYearlyCycle && isActiveSubscriptionStatus && isWithinSubscriptionWindow
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

  async listTeamsByMasterId(
    masterProfileId: string
  ): Promise<Array<{ id: string; name: string }> | null> {
    const master = await prisma.profile.findFirst({
      where: {
        id: masterProfileId,
        isMaster: true,
        role: "manager",
      },
      select: { id: true },
    })

    if (!master) return null

    return prisma.team.findMany({
      where: { masterId: masterProfileId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    })
  }

  async findTeamMember(teamId: string, profileId: string): Promise<{ id: string } | null> {
    return prisma.teamMember.findUnique({
      where: { teamId_profileId: { teamId, profileId } },
      select: { id: true },
    })
  }

  async findTeamByIdAndMasterId(teamId: string, masterId: string): Promise<{ id: string } | null> {
    return prisma.team.findFirst({
      where: { id: teamId, masterId },
      select: { id: true },
    })
  }

  async findProfileByEmail(email: string): Promise<{
    id: string
    email: string
    fullName: string | null
    supabaseId: string | null
    isMaster: boolean
    managerId: string | null
  } | null> {
    return prisma.profile.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        fullName: true,
        supabaseId: true,
        isMaster: true,
        managerId: true,
      },
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
      canTransferAccountLeads?: boolean
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
        },
        select: { id: true },
      })

      const teamMember = await tx.teamMember.create({
        data: {
          teamId,
          profileId: profile.id,
          role: data.role as UserRole,
          functions: data.functions as UserFunction[],
          canCreateAccountUsers: data.role === "manager" && data.canCreateAccountUsers === true,
          canManageAccountTeams: data.role === "manager" && data.canManageAccountTeams === true,
          canTransferAccountLeads:
            (data.role === "manager" || data.role === "backoffice") &&
            data.canTransferAccountLeads === true,
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
    permissions?: {
      canCreateAccountUsers: boolean
      canManageAccountTeams: boolean
      canTransferAccountLeads: boolean
    }
  ): Promise<{ teamMemberId: string }> {
    const teamMember = await prisma.teamMember.create({
      data: {
        profileId,
        teamId,
        role: role as UserRole,
        functions: functions as UserFunction[],
        canCreateAccountUsers: role === "manager" && permissions?.canCreateAccountUsers === true,
        canManageAccountTeams: role === "manager" && permissions?.canManageAccountTeams === true,
        canTransferAccountLeads:
          (role === "manager" || role === "backoffice") &&
          permissions?.canTransferAccountLeads === true,
      },
      select: { id: true },
    })

    return { teamMemberId: teamMember.id }
  }

  async createTeamForMaster(masterProfileId: string, name: string): Promise<{ id: string; name: string }> {
    return prisma.$transaction(async (tx) => {
      const existingTeamsCount = await tx.team.count({
        where: { masterId: masterProfileId },
      })
      const team = await tx.team.create({
        data: {
          name,
          masterId: masterProfileId,
          isDefault: existingTeamsCount === 0,
        },
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

  async syncTeamTransferRoutes(
    teamId: string,
    masterId: string,
    targetTeamIds: string[],
    createdBy: string
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.teamTransferRoute.deleteMany({ where: { sourceTeamId: teamId } })
      if (targetTeamIds.length > 0) {
        await tx.teamTransferRoute.createMany({
          data: targetTeamIds.map((tid) => ({
            sourceTeamId: teamId,
            targetTeamId: tid,
            createdBy,
          })),
          skipDuplicates: true,
        })
      }
    })
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

  async assertUserSubscriptionCapacity(masterProfileId: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await subscriptionCreditRepository.assertCapacityAvailable(tx, masterProfileId, { users: 1 })
    })
  }
}
