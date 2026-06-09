import type { Prisma } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import type {
  BackofficeAllUsersDetailRecord,
  BackofficeAllUsersFiltersInput,
  BackofficeAllUsersListRecord,
  BackofficeAllUsersListResult,
  BackofficeAllUsersPaginationInput,
  BackofficeAllUsersUserTypeRef,
  BackofficeUpsertUserTypeAssignmentInput,
  IBackofficeAllUsersRepository,
} from "./IBackofficeAllUsersRepository"

function mapUserType(assignment: { accessExpiresAt: Date | null; userType: { slug: string } } | null): BackofficeAllUsersUserTypeRef {
  const slug: "common" | "member_pro" = assignment?.userType.slug === "member_pro" ? "member_pro" : "common"
  const accessExpiresAt = assignment?.accessExpiresAt ? assignment.accessExpiresAt.toISOString() : null
  const isExpired = slug === "member_pro" && accessExpiresAt !== null && new Date(accessExpiresAt).getTime() <= Date.now()

  let label = "Comum"
  if (slug === "member_pro") {
    label = isExpired ? "MEMBER PRO (EXPIRADO)" : "MEMBER PRO"
  }

  return { slug, label, accessExpiresAt, isExpired }
}

const PROFILE_LIST_SELECT = {
  id: true,
  fullName: true,
  email: true,
  phone: true,
  role: true,
  functions: true,
  isMaster: true,
  googleConnection: {
    select: { googleEmail: true, refreshToken: true, revokedAt: true },
  },
  createdAt: true,
  manager: {
    select: {
      id: true,
      fullName: true,
      subscription: { select: { hasPermanentSubscription: true, subscriptionPlan: true } },
      _count: { select: { operators: true } },
      userTypeAssignment: {
        select: {
          accessExpiresAt: true,
          userType: { select: { slug: true } },
        },
      },
    },
  },
  subscription: { select: { hasPermanentSubscription: true, subscriptionPlan: true } },
  _count: { select: { operators: true } },
  userTypeAssignment: {
    select: {
      accessExpiresAt: true,
      userType: { select: { slug: true } },
    },
  },
} satisfies Prisma.ProfileSelect

type ProfileListRow = Prisma.ProfileGetPayload<{ select: typeof PROFILE_LIST_SELECT }>

function mapRow(profile: ProfileListRow): BackofficeAllUsersListRecord {
  let masterRef = null

  if (profile.isMaster) {
    masterRef = {
      id: profile.id,
      fullName: profile.fullName,
      hasPermanentSubscription: profile.subscription?.hasPermanentSubscription ?? false,
      subscriptionPlan: profile.subscription?.subscriptionPlan ?? null,
      operatorCount: profile._count.operators,
    }
  } else if (profile.manager) {
    masterRef = {
      id: profile.manager.id,
      fullName: profile.manager.fullName,
      hasPermanentSubscription: profile.manager.subscription?.hasPermanentSubscription ?? false,
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
    functions: profile.functions,
    isMaster: profile.isMaster,
    googleCalendarConnected: !!profile.googleConnection?.refreshToken && !profile.googleConnection?.revokedAt,
    createdAt: profile.createdAt,
    master: masterRef,
    userType: mapUserType(profile.isMaster ? profile.userTypeAssignment : profile.manager?.userTypeAssignment ?? null),
  }
}

function buildPlanFilter(plan: BackofficeAllUsersFiltersInput["plan"]): Prisma.ProfileWhereInput | null {
  if (!plan) return null

  if (plan === "lifetime") {
    return {
      OR: [
        { isMaster: true, subscription: { is: { hasPermanentSubscription: true } } },
        { isMaster: false, manager: { is: { subscription: { is: { hasPermanentSubscription: true } } } } },
      ],
    }
  }

  if (plan === "trial") {
    return {
      OR: [
        { isMaster: true, subscription: { is: { hasPermanentSubscription: false, subscriptionPlan: "free_trial" } } },
        {
          isMaster: false,
          manager: {
            is: {
              subscription: { is: { hasPermanentSubscription: false, subscriptionPlan: "free_trial" } },
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
          subscription: { is: { hasPermanentSubscription: false, subscriptionPlan: { in: ["manager_base", "with_operators"] } } },
        },
        {
          isMaster: false,
          manager: {
            is: {
              subscription: { is: { hasPermanentSubscription: false, subscriptionPlan: { in: ["manager_base", "with_operators"] } } },
            },
          },
        },
      ],
    }
  }

  if (plan === "none") {
    return {
      OR: [
        { isMaster: true, subscription: { is: null } },
        {
          isMaster: false,
          manager: { is: { subscription: { is: null } } },
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

  if (filters.userType === "member_pro") {
    andClauses.push({
      OR: [
        { isMaster: true, userTypeAssignment: { is: { userType: { is: { slug: "member_pro" } } } } },
        {
          isMaster: false,
          manager: { is: { userTypeAssignment: { is: { userType: { is: { slug: "member_pro" } } } } } },
        },
      ],
    })
  } else if (filters.userType === "common") {
    andClauses.push({
      OR: [
        {
          isMaster: true,
          OR: [
            { userTypeAssignment: { is: null } },
            { userTypeAssignment: { is: { userType: { is: { slug: "common" } } } } },
          ],
        },
        {
          isMaster: false,
          OR: [
            { manager: { is: { userTypeAssignment: { is: null } } } },
            { manager: { is: { userTypeAssignment: { is: { userType: { is: { slug: "common" } } } } } } },
          ],
        },
      ],
    })
  }

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
      googleEmail: profile.googleConnection?.googleEmail ?? null,
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

  async findIsMaster(profileId: string): Promise<boolean | null> {
    const profile = await prisma.profile.findUnique({
      where: { id: profileId },
      select: { isMaster: true },
    })

    return profile?.isMaster ?? null
  }

  async upsertUserTypeAssignment(
    profileId: string,
    data: BackofficeUpsertUserTypeAssignmentInput
  ): Promise<BackofficeAllUsersUserTypeRef> {
    const userType = await prisma.profileUserType.findUniqueOrThrow({
      where: { slug: data.userType },
      select: { id: true },
    })

    const assignmentData = {
      userTypeId: userType.id,
      accessExpiresAt: data.accessExpiresAt,
      assignedByProfileId: data.assignedByProfileId,
    }

    const assignment = await prisma.profileUserTypeAssignment.upsert({
      where: { profileId },
      update: assignmentData,
      create: { profileId, ...assignmentData },
      select: {
        accessExpiresAt: true,
        userType: { select: { slug: true } },
      },
    })

    return mapUserType(assignment)
  }
}
