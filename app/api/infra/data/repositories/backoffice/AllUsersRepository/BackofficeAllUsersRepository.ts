import type { Prisma } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import type {
  BackofficeAllUsersDetailRecord,
  BackofficeAllUsersFiltersInput,
  BackofficeAllUsersListRecord,
  BackofficeAllUsersListResult,
  BackofficeAllUsersPaginationInput,
  IBackofficeAllUsersRepository,
} from "./IBackofficeAllUsersRepository"

const PROFILE_LIST_SELECT = {
  id: true,
  fullName: true,
  email: true,
  phone: true,
  role: true,
  isMaster: true,
  googleCalendarConnected: true,
  createdAt: true,
  manager: {
    select: {
      id: true,
      fullName: true,
      hasPermanentSubscription: true,
      subscription: { select: { subscriptionPlan: true } },
      _count: { select: { operators: true } },
    },
  },
  hasPermanentSubscription: true,
  subscription: { select: { subscriptionPlan: true } },
  _count: { select: { operators: true } },
} satisfies Prisma.ProfileSelect

type ProfileListRow = Prisma.ProfileGetPayload<{ select: typeof PROFILE_LIST_SELECT }>

function mapRow(profile: ProfileListRow): BackofficeAllUsersListRecord {
  let masterRef = null

  if (profile.isMaster) {
    masterRef = {
      id: profile.id,
      fullName: profile.fullName,
      hasPermanentSubscription: profile.hasPermanentSubscription,
      subscriptionPlan: profile.subscription?.subscriptionPlan ?? null,
      operatorCount: profile._count.operators,
    }
  } else if (profile.manager) {
    masterRef = {
      id: profile.manager.id,
      fullName: profile.manager.fullName,
      hasPermanentSubscription: profile.manager.hasPermanentSubscription,
      subscriptionPlan: profile.manager.subscription?.subscriptionPlan ?? null,
      operatorCount: profile.manager._count.operators,
    }
  }

  return {
    id: profile.id,
    fullName: profile.fullName,
    email: profile.email,
    phone: profile.phone,
    role: profile.role,
    isMaster: profile.isMaster,
    googleCalendarConnected: profile.googleCalendarConnected,
    createdAt: profile.createdAt,
    master: masterRef,
  }
}

function buildPlanFilter(plan: BackofficeAllUsersFiltersInput["plan"]): Prisma.ProfileWhereInput | null {
  if (!plan) return null

  if (plan === "lifetime") {
    return {
      OR: [
        { isMaster: true, hasPermanentSubscription: true },
        { isMaster: false, manager: { is: { hasPermanentSubscription: true } } },
      ],
    }
  }

  if (plan === "trial") {
    return {
      OR: [
        { isMaster: true, hasPermanentSubscription: false, subscription: { is: { subscriptionPlan: "free_trial" } } },
        {
          isMaster: false,
          manager: {
            is: {
              hasPermanentSubscription: false,
              subscription: { is: { subscriptionPlan: "free_trial" } },
            },
          },
        },
      ],
    }
  }

  if (plan === "monthly") {
    return {
      OR: [
        {
          isMaster: true,
          hasPermanentSubscription: false,
          subscription: { is: { subscriptionPlan: { in: ["manager_base", "with_operators"] } } },
        },
        {
          isMaster: false,
          manager: {
            is: {
              hasPermanentSubscription: false,
              subscription: { is: { subscriptionPlan: { in: ["manager_base", "with_operators"] } } },
            },
          },
        },
      ],
    }
  }

  if (plan === "none") {
    return {
      OR: [
        { isMaster: true, hasPermanentSubscription: false, subscription: { is: null } },
        {
          isMaster: false,
          manager: { is: { hasPermanentSubscription: false, subscription: { is: null } } },
        },
      ],
    }
  }

  return null
}

function buildWhere(filters: BackofficeAllUsersFiltersInput): Prisma.ProfileWhereInput {
  const andClauses: Prisma.ProfileWhereInput[] = [{ role: { not: "backoffice" } }]

  const query = filters.query?.trim()
  if (query) {
    andClauses.push({
      OR: [
        { fullName: { contains: query, mode: "insensitive" } },
        { email: { contains: query, mode: "insensitive" } },
        { phone: { contains: query, mode: "insensitive" } },
      ],
    })
  }

  if (filters.role === "master") {
    andClauses.push({ isMaster: true })
  } else if (filters.role === "manager") {
    andClauses.push({ role: "manager", isMaster: false })
  } else if (filters.role === "operator") {
    andClauses.push({ role: "operator" })
  }

  const planFilter = buildPlanFilter(filters.plan)
  if (planFilter) andClauses.push(planFilter)

  return { AND: andClauses }
}

export class BackofficeAllUsersRepository implements IBackofficeAllUsersRepository {
  async list(
    filters: BackofficeAllUsersFiltersInput,
    pagination: BackofficeAllUsersPaginationInput
  ): Promise<BackofficeAllUsersListResult> {
    const where = buildWhere(filters)
    const skip = (pagination.page - 1) * pagination.pageSize

    const [rows, totalItems] = await Promise.all([
      prisma.profile.findMany({
        where,
        select: PROFILE_LIST_SELECT,
        orderBy: [{ createdAt: "desc" }],
        skip,
        take: pagination.pageSize,
      }),
      prisma.profile.count({ where }),
    ])

    return {
      items: rows.map(mapRow),
      totalItems,
    }
  }

  async findDetailById(profileId: string): Promise<BackofficeAllUsersDetailRecord | null> {
    const profile = await prisma.profile.findUnique({
      where: { id: profileId },
      select: {
        ...PROFILE_LIST_SELECT,
        googleEmail: true,
        teamMemberships: {
          select: {
            team: {
              select: {
                id: true,
                name: true,
                createdAt: true,
                masterId: true,
                master: { select: { fullName: true } },
                _count: { select: { members: true } },
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    })

    if (!profile) return null

    const base = mapRow(profile)

    return {
      ...base,
      googleEmail: profile.googleEmail,
      teams: profile.teamMemberships.map((membership) => ({
        id: membership.team.id,
        name: membership.team.name,
        createdAt: membership.team.createdAt,
        membersCount: membership.team._count.members,
        masterId: membership.team.masterId,
        masterFullName: membership.team.master?.fullName ?? null,
      })),
    }
  }
}
