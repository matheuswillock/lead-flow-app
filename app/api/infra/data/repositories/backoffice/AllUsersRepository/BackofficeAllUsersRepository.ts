import type { LeadStatus, Prisma } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import { hasAnnualOrActiveYearlyUnlimitedGrant } from "@/app/api/infra/data/repositories/billing/unlimitedUsersGrantQueries"
import {
  getScheduleMeetingStatus,
  type ScheduleMeetingStatus,
} from "@/lib/lead-meeting"
import type {
  BackofficeAllUsersDetailRecord,
  BackofficeAllUsersEmailDispatchFiltersInput,
  BackofficeAllUsersFiltersInput,
  BackofficeAllUsersListRecord,
  BackofficeAllUsersListResult,
  BackofficeAllUsersPaginationInput,
  BackofficeAllUsersScheduleFiltersInput,
  BackofficeAllUsersScheduleListResult,
  BackofficeAllUsersScheduleMemberRef,
  BackofficeAllUsersScheduleRecord,
  BackofficeAllUsersScheduleTransferRef,
  BackofficeAllUsersUserTypeRef,
  BackofficeUpsertUserTypeAssignmentInput,
  IBackofficeAllUsersRepository,
} from "./IBackofficeAllUsersRepository"

const SCHEDULE_LEAD_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  status: true,
  meetingHeald: true,
  assignedTo: true,
  closerId: true,
  isTransfer: true,
  assignee: {
    select: { id: true, fullName: true, email: true },
  },
  closer: {
    select: { id: true, fullName: true, email: true },
  },
  team: {
    select: { name: true },
  },
  manager: {
    select: { fullName: true },
  },
  transfers: {
    take: 1,
    orderBy: { createdAt: "desc" as const },
    select: {
      fromTeam: { select: { name: true } },
      transferredByProfile: { select: { fullName: true } },
      fromManagerId: true,
      scheduledAtTransfer: true,
      createdAt: true,
    },
  },
} satisfies Prisma.LeadSelect

type ScheduleLeadRow = Prisma.LeadGetPayload<{ select: typeof SCHEDULE_LEAD_SELECT }>

function mapScheduleMember(
  profile: { id: string; fullName: string | null; email: string } | null | undefined
): BackofficeAllUsersScheduleMemberRef | null {
  if (!profile) return null
  return {
    id: profile.id,
    fullName: profile.fullName,
    email: profile.email,
  }
}

function mapScheduleTransfer(
  lead: ScheduleLeadRow,
  fromManagerNames: Map<string, string | null>
): BackofficeAllUsersScheduleTransferRef | null {
  const latestTransfer = lead.transfers[0]

  if (latestTransfer) {
    return {
      kind: "completed",
      fromTeamName: latestTransfer.fromTeam.name,
      fromManagerName: fromManagerNames.get(latestTransfer.fromManagerId) ?? null,
      transferredByName: latestTransfer.transferredByProfile.fullName,
      transferredAt: latestTransfer.createdAt,
      scheduledAtTransfer: latestTransfer.scheduledAtTransfer,
    }
  }

  if (lead.isTransfer) {
    return {
      kind: "pending",
      fromTeamName: lead.team?.name ?? "—",
      fromManagerName: lead.manager?.fullName ?? null,
      transferredByName: null,
      transferredAt: null,
      scheduledAtTransfer: false,
    }
  }

  return null
}

function buildMeetingStatusWhere(
  status: ScheduleMeetingStatus,
  now: Date
): Prisma.LeadsScheduleWhereInput {
  if (status === "canceled") {
    return { id: { in: [] } }
  }
  if (status === "scheduled") {
    return { date: { gt: now } }
  }
  if (status === "realized") {
    return {
      date: { lte: now },
      lead: { meetingHeald: "yes" },
    }
  }
  return {
    date: { lte: now },
    OR: [{ lead: { meetingHeald: "no" } }, { lead: { meetingHeald: null } }],
  }
}

function buildScheduleWhere(
  profileId: string,
  filters: BackofficeAllUsersScheduleFiltersInput
): Prisma.LeadsScheduleWhereInput {
  const now = new Date()
  const and: Prisma.LeadsScheduleWhereInput[] = []

  const functions = filters.functions ?? []
  if (functions.length === 0) {
    and.push({
      OR: [
        { lead: { assignedTo: profileId } },
        { lead: { closerId: profileId } },
      ],
    })
  } else {
    const roleConditions: Prisma.LeadsScheduleWhereInput[] = []
    if (functions.includes("sdr")) {
      roleConditions.push({ lead: { assignedTo: profileId } })
    }
    if (functions.includes("closer")) {
      roleConditions.push({ lead: { closerId: profileId } })
    }
    if (roleConditions.length === 1) {
      and.push(roleConditions[0]!)
    } else if (roleConditions.length > 1) {
      and.push({ OR: roleConditions })
    }
  }

  const query = filters.query?.trim()
  if (query) {
    and.push({
      lead: {
        name: { contains: query, mode: "insensitive" },
      },
    })
  }

  if (filters.leadStatuses && filters.leadStatuses.length > 0) {
    and.push({
      lead: {
        status: { in: filters.leadStatuses as LeadStatus[] },
      },
    })
  }

  if (filters.dateFrom || filters.dateTo) {
    and.push({
      date: {
        ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
        ...(filters.dateTo ? { lte: filters.dateTo } : {}),
      },
    })
  }

  const meetingStatuses = filters.meetingStatuses
  if (meetingStatuses && meetingStatuses.length > 0) {
    and.push({
      OR: meetingStatuses.map((status) => buildMeetingStatusWhere(status, now)),
    })
  }

  if (and.length === 0) return {}
  if (and.length === 1) return and[0]!
  return { AND: and }
}

function mapUserType(
  assignment: { accessExpiresAt: Date | null; userType: { slug: string } } | null,
  sponsor?: { id: string; fullName: string | null } | null
): BackofficeAllUsersUserTypeRef {
  const rawSlug = assignment?.userType.slug
  const slug: BackofficeAllUsersUserTypeRef["slug"] =
    rawSlug === "member_pro"
      ? "member_pro"
      : rawSlug === "associate"
        ? "associate"
        : rawSlug === "guest"
          ? "guest"
          : "common"
  const accessExpiresAt = assignment?.accessExpiresAt ? assignment.accessExpiresAt.toISOString() : null
  const isExpired = slug === "member_pro" && accessExpiresAt !== null && new Date(accessExpiresAt).getTime() <= Date.now()

  let label = "Comum"
  if (slug === "member_pro") {
    label = isExpired ? "MEMBER PRO (EXPIRADO)" : "MEMBER PRO"
  } else if (slug === "associate") {
    label = "Associado"
  } else if (slug === "guest") {
    label = "Convidado"
  }

  return {
    slug,
    label,
    accessExpiresAt,
    isExpired,
    sponsorMasterId: sponsor?.id ?? null,
    sponsorMasterName: sponsor?.fullName ?? null,
  }
}

const PROFILE_LIST_SELECT = {
  id: true,
  supabaseId: true,
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
      hasPermanentSubscription: true,
      subscription: { select: { subscriptionPlan: true } },
      _count: { select: { operators: true } },
      userTypeAssignment: {
        select: {
          accessExpiresAt: true,
          userType: { select: { slug: true } },
        },
      },
    },
  },
  hasPermanentSubscription: true,
  subscription: { select: { subscriptionPlan: true } },
  _count: { select: { operators: true } },
  userTypeAssignment: {
    select: {
      accessExpiresAt: true,
      userType: { select: { slug: true } },
    },
  },
  sponsorMasterId: true,
  sponsorMaster: {
    select: { id: true, fullName: true },
  },
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
    supabaseId: profile.supabaseId,
    fullName: profile.fullName,
    email: profile.email,
    phone: profile.phone,
    role: profile.role,
    functions: profile.functions,
    isMaster: profile.isMaster,
    googleCalendarConnected: !!profile.googleConnection?.refreshToken && !profile.googleConnection?.revokedAt,
    createdAt: profile.createdAt,
    master: masterRef,
    userType: mapUserType(
      profile.isMaster ? profile.userTypeAssignment : profile.manager?.userTypeAssignment ?? null,
      profile.isMaster ? profile.sponsorMaster : null
    ),
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
  } else if (filters.userType === "associate") {
    andClauses.push({
      OR: [
        { isMaster: true, userTypeAssignment: { is: { userType: { is: { slug: "associate" } } } } },
        {
          isMaster: false,
          manager: { is: { userTypeAssignment: { is: { userType: { is: { slug: "associate" } } } } } },
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

  async findSchedulesByProfileId(
    profileId: string,
    filters: BackofficeAllUsersScheduleFiltersInput,
    pagination: BackofficeAllUsersPaginationInput
  ): Promise<BackofficeAllUsersScheduleListResult> {
    const where = buildScheduleWhere(profileId, filters)
    const skip = (pagination.page - 1) * pagination.pageSize

    const [productSchedules, totalItems] = await Promise.all([
      prisma.leadsSchedule.findMany({
        where,
        select: {
          id: true,
          date: true,
          meetingTitle: true,
          meetingLink: true,
          notes: true,
          createdAt: true,
          lead: {
            select: SCHEDULE_LEAD_SELECT,
          },
        },
        orderBy: { date: "desc" },
        skip,
        take: pagination.pageSize,
      }),
      prisma.leadsSchedule.count({ where }),
    ])

    const fromManagerIds = [
      ...new Set(
        productSchedules.flatMap((schedule) =>
          schedule.lead.transfers.map((transfer) => transfer.fromManagerId)
        )
      ),
    ]

    const fromManagers =
      fromManagerIds.length > 0
        ? await prisma.profile.findMany({
            where: { id: { in: fromManagerIds } },
            select: { id: true, fullName: true },
          })
        : []

    const fromManagerNames = new Map(
      fromManagers.map((manager) => [manager.id, manager.fullName])
    )

    const items: BackofficeAllUsersScheduleRecord[] = productSchedules.map((schedule) => {
      const isCanceled = false
      const meetingStatus = getScheduleMeetingStatus({
        date: schedule.date,
        meetingHeald: schedule.lead.meetingHeald,
        isCanceled,
      })

      return {
        id: schedule.id,
        source: "product" as const,
        role: schedule.lead.closerId === profileId ? ("closer" as const) : ("sdr" as const),
        date: schedule.date,
        meetingTitle: schedule.meetingTitle,
        meetingLink: schedule.meetingLink,
        notes: schedule.notes,
        isCanceled,
        meetingStatus,
        createdAt: schedule.createdAt,
        sdr: mapScheduleMember(schedule.lead.assignee),
        closer: mapScheduleMember(schedule.lead.closer),
        transfer: mapScheduleTransfer(schedule.lead, fromManagerNames),
        lead: {
          id: schedule.lead.id,
          name: schedule.lead.name,
          email: schedule.lead.email,
          phone: schedule.lead.phone,
          status: schedule.lead.status,
          meetingHeald: schedule.lead.meetingHeald,
        },
      }
    })

    return { items, totalItems }
  }

  async findEmailDispatchesByProfileId(
    profileId: string,
    filters: BackofficeAllUsersEmailDispatchFiltersInput,
    pagination: BackofficeAllUsersPaginationInput
  ) {
    const andClauses: Prisma.BackofficeEmailDispatchWhereInput[] = [{ profileId }]

    if (filters.query?.trim()) {
      const query = filters.query.trim()
      andClauses.push({
        OR: [
          { subject: { contains: query, mode: "insensitive" } },
          { recipientEmail: { contains: query, mode: "insensitive" } },
        ],
      })
    }

    if (filters.statuses?.length) {
      andClauses.push({
        status: { in: filters.statuses as Prisma.EnumBackofficeEmailDispatchStatusFilter["in"] },
      })
    }

    if (filters.providers?.length) {
      andClauses.push({
        provider: { in: filters.providers as Prisma.EnumBackofficeEmailDispatchProviderFilter["in"] },
      })
    }

    if (filters.categories?.length) {
      andClauses.push({
        category: { in: filters.categories as Prisma.EnumBackofficeEmailDispatchCategoryFilter["in"] },
      })
    }

    if (filters.dateFrom || filters.dateTo) {
      andClauses.push({
        createdAt: {
          ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
          ...(filters.dateTo ? { lte: filters.dateTo } : {}),
        },
      })
    }

    const where: Prisma.BackofficeEmailDispatchWhereInput = { AND: andClauses }
    const skip = (pagination.page - 1) * pagination.pageSize

    const [rows, totalItems] = await Promise.all([
      prisma.backofficeEmailDispatch.findMany({
        where,
        select: {
          id: true,
          recipientEmail: true,
          recipientKind: true,
          provider: true,
          category: true,
          subject: true,
          status: true,
          errorMessage: true,
          sentAt: true,
          deliveredAt: true,
          openedAt: true,
          clickedAt: true,
          bouncedAt: true,
          complainedAt: true,
          createdAt: true,
          events: {
            select: {
              id: true,
              type: true,
              occurredAt: true,
            },
            orderBy: { occurredAt: "desc" },
            take: 10,
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: pagination.pageSize,
      }),
      prisma.backofficeEmailDispatch.count({ where }),
    ])

    return {
      items: rows,
      totalItems,
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

  async updateSponsorMasterId(profileId: string, sponsorMasterId: string | null): Promise<void> {
    await prisma.profile.update({
      where: { id: profileId },
      data: { sponsorMasterId },
    })
  }

  async setHasPermanentSubscription(profileId: string, value: boolean): Promise<void> {
    await prisma.profile.update({
      where: { id: profileId },
      data: {
        hasPermanentSubscription: value,
        // Vitalício sempre concede usuários ilimitados.
        ...(value ? { hasUnlimitedUsers: true } : {}),
      },
    })
  }

  async setHasUnlimitedUsers(profileId: string, value: boolean): Promise<void> {
    await prisma.profile.update({
      where: { id: profileId },
      data: { hasUnlimitedUsers: value },
    })
  }

  async clearHasUnlimitedUsersUnlessAnnualAdhesion(profileId: string): Promise<boolean> {
    const profile = await prisma.profile.findUnique({
      where: { id: profileId },
      select: { hasPermanentSubscription: true },
    })

    // Mantém ilimitado se vitalício ou se ainda houver adesão anual paga (flag de intenção anual).
    if (profile?.hasPermanentSubscription) {
      return false
    }

    const hasIndependentGrant = await hasAnnualOrActiveYearlyUnlimitedGrant(profileId)

    if (hasIndependentGrant) {
      await prisma.profile.update({
        where: { id: profileId },
        data: { hasUnlimitedUsers: true },
      })
      return false
    }

    await prisma.profile.update({
      where: { id: profileId },
      data: { hasUnlimitedUsers: false },
    })
    return true
  }

  async hasOpenProposalReviewsForAssociate(profileId: string): Promise<boolean> {
    const count = await prisma.leadProposalReview.count({
      where: {
        status: { in: ["submitted", "criticized", "pending"] },
        lead: {
          team: {
            masterId: profileId,
          },
        },
      },
    })
    return count > 0
  }
}
