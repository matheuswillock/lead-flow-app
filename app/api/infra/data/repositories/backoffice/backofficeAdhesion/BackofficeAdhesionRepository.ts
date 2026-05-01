import { Prisma, UserRole, type BackofficeAdhesionStatus } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import type {
  BackofficeAdhesionOptions,
  BackofficeAdhesionWithRelations,
  CreateBackofficeAdhesionManagerProfileInput,
  CreateBackofficeAdhesionInput,
  IBackofficeAdhesionRepository,
  ListBackofficeAdhesionsInput,
  ListBackofficeAdhesionsResult,
  UpdateBackofficeAdhesionCheckoutInput,
  UpdateBackofficeAdhesionInput,
} from "./IBackofficeAdhesionRepository"

const backofficeAdhesionUserSelect = {
  id: true,
  email: true,
  isActive: true,
  isSdr: true,
  isCloser: true,
  profile: {
    select: {
      fullName: true,
      email: true,
    },
  },
} satisfies Prisma.BackofficeUserSelect

const backofficeAdhesionLeadSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  status: true,
  sdrBackofficeUserId: true,
  closerBackofficeUserId: true,
} satisfies Prisma.BackofficeLeadSelect

const backofficeAdhesionInclude = {
  lead: {
    select: backofficeAdhesionLeadSelect,
  },
  sdrBackofficeUser: {
    select: backofficeAdhesionUserSelect,
  },
  closerBackofficeUser: {
    select: backofficeAdhesionUserSelect,
  },
} satisfies Prisma.BackofficeAdhesionInclude

const eligibleLeadStatuses = ["new_opportunity", "scheduled", "no_show"] as const

function toDecimal(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value)
}

export class BackofficeAdhesionRepository implements IBackofficeAdhesionRepository {
  async createAndMoveLeadToAdhesion(
    data: CreateBackofficeAdhesionInput
  ): Promise<BackofficeAdhesionWithRelations> {
    return prisma.$transaction(async (tx) => {
      const adhesion = await tx.backofficeAdhesion.create({
        data: {
          leadId: data.leadId,
          fullName: data.fullName,
          phone: data.phone,
          plan: data.plan,
          cycle: data.cycle,
          modules: data.modules,
          extraTeams: data.extraTeams,
          extraUsers: data.extraUsers,
          monthlyBaseAmount: toDecimal(data.monthlyBaseAmount),
          monthlyExtraTeamsAmount: toDecimal(data.monthlyExtraTeamsAmount),
          monthlyExtraUsersAmount: toDecimal(data.monthlyExtraUsersAmount),
          monthlyTotalAmount: toDecimal(data.monthlyTotalAmount),
          totalAmount: toDecimal(data.totalAmount),
          tokenHash: data.tokenHash,
          tokenPreview: data.tokenPreview,
          expiresAt: data.expiresAt,
          sdrBackofficeUserId: data.sdrBackofficeUserId ?? null,
          closerBackofficeUserId: data.closerBackofficeUserId ?? null,
          createdByBackofficeUserId: data.createdByBackofficeUserId ?? null,
        },
        include: backofficeAdhesionInclude,
      })

      await tx.backofficeLead.update({
        where: { id: data.leadId },
        data: {
          status: "new_adhesion",
          statusEnteredAt: new Date(),
        },
      })

      return adhesion
    })
  }

  async list(input: ListBackofficeAdhesionsInput): Promise<ListBackofficeAdhesionsResult> {
    const page = Math.max(input.page, 1)
    const pageSize = Math.max(input.pageSize, 5)
    const query = input.query?.trim()
    const where: Prisma.BackofficeAdhesionWhereInput = {
      ...(input.status ? { status: input.status } : {}),
      ...(query
        ? {
            OR: [
              { fullName: { contains: query, mode: "insensitive" } },
              { phone: { contains: query, mode: "insensitive" } },
              { email: { contains: query, mode: "insensitive" } },
              { lead: { name: { contains: query, mode: "insensitive" } } },
            ],
          }
        : {}),
    }

    const [items, totalItems] = await Promise.all([
      prisma.backofficeAdhesion.findMany({
        where,
        include: backofficeAdhesionInclude,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.backofficeAdhesion.count({ where }),
    ])

    return { items, totalItems }
  }

  async findById(id: string): Promise<BackofficeAdhesionWithRelations | null> {
    return prisma.backofficeAdhesion.findUnique({
      where: { id },
      include: backofficeAdhesionInclude,
    })
  }

  async findByLeadId(leadId: string): Promise<BackofficeAdhesionWithRelations | null> {
    return prisma.backofficeAdhesion.findUnique({
      where: { leadId },
      include: backofficeAdhesionInclude,
    })
  }

  async findByAsaasPaymentId(
    paymentId: string
  ): Promise<BackofficeAdhesionWithRelations | null> {
    return prisma.backofficeAdhesion.findUnique({
      where: { asaasPaymentId: paymentId },
      include: backofficeAdhesionInclude,
    })
  }

  async findByTokenHash(tokenHash: string): Promise<BackofficeAdhesionWithRelations | null> {
    return prisma.backofficeAdhesion.findUnique({
      where: { tokenHash },
      include: backofficeAdhesionInclude,
    })
  }

  async update(
    id: string,
    data: UpdateBackofficeAdhesionInput
  ): Promise<BackofficeAdhesionWithRelations> {
    return prisma.backofficeAdhesion.update({
      where: { id },
      data: {
        ...(data.fullName !== undefined ? { fullName: data.fullName } : {}),
        ...(data.phone !== undefined ? { phone: data.phone } : {}),
        ...(data.cycle !== undefined ? { cycle: data.cycle } : {}),
        ...(data.modules !== undefined ? { modules: data.modules } : {}),
        ...(data.extraTeams !== undefined ? { extraTeams: data.extraTeams } : {}),
        ...(data.extraUsers !== undefined ? { extraUsers: data.extraUsers } : {}),
        ...(data.monthlyBaseAmount !== undefined
          ? { monthlyBaseAmount: toDecimal(data.monthlyBaseAmount) }
          : {}),
        ...(data.monthlyExtraTeamsAmount !== undefined
          ? { monthlyExtraTeamsAmount: toDecimal(data.monthlyExtraTeamsAmount) }
          : {}),
        ...(data.monthlyExtraUsersAmount !== undefined
          ? { monthlyExtraUsersAmount: toDecimal(data.monthlyExtraUsersAmount) }
          : {}),
        ...(data.monthlyTotalAmount !== undefined
          ? { monthlyTotalAmount: toDecimal(data.monthlyTotalAmount) }
          : {}),
        ...(data.totalAmount !== undefined ? { totalAmount: toDecimal(data.totalAmount) } : {}),
        ...(data.sdrBackofficeUserId !== undefined
          ? { sdrBackofficeUserId: data.sdrBackofficeUserId }
          : {}),
        ...(data.closerBackofficeUserId !== undefined
          ? { closerBackofficeUserId: data.closerBackofficeUserId }
          : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.tokenHash !== undefined ? { tokenHash: data.tokenHash } : {}),
        ...(data.tokenPreview !== undefined ? { tokenPreview: data.tokenPreview } : {}),
        ...(data.expiresAt !== undefined ? { expiresAt: data.expiresAt } : {}),
      },
      include: backofficeAdhesionInclude,
    })
  }

  async updateCheckoutData(
    id: string,
    data: UpdateBackofficeAdhesionCheckoutInput
  ): Promise<BackofficeAdhesionWithRelations> {
    return prisma.backofficeAdhesion.update({
      where: { id },
      data,
      include: backofficeAdhesionInclude,
    })
  }

  async updateStatus(
    id: string,
    status: BackofficeAdhesionStatus,
    dates?: { paidAt?: Date; overdueAt?: Date; canceledAt?: Date }
  ): Promise<BackofficeAdhesionWithRelations> {
    return prisma.backofficeAdhesion.update({
      where: { id },
      data: {
        status,
        ...(dates?.paidAt ? { paidAt: dates.paidAt } : {}),
        ...(dates?.overdueAt ? { overdueAt: dates.overdueAt } : {}),
        ...(dates?.canceledAt ? { canceledAt: dates.canceledAt } : {}),
      },
      include: backofficeAdhesionInclude,
    })
  }

  async markAccountCreated(
    id: string,
    data: { createdProfileId: string; createdSupabaseId: string }
  ): Promise<BackofficeAdhesionWithRelations> {
    return prisma.backofficeAdhesion.update({
      where: { id },
      data,
      include: backofficeAdhesionInclude,
    })
  }

  async findProfileIdByEmail(email: string): Promise<string | null> {
    const profile = await prisma.profile.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true },
    })

    return profile?.id ?? null
  }

  async createPaidManagerProfile(
    data: CreateBackofficeAdhesionManagerProfileInput
  ): Promise<{ profileId: string; supabaseId: string }> {
    const profileData: Prisma.ProfileUncheckedCreateInput = {
      supabaseId: data.supabaseId,
      fullName: data.fullName,
      phone: data.phone,
      email: data.email,
      role: UserRole.manager,
      isMaster: true,
      functions: ["SDR", "CLOSER"],
      cpfCnpj: data.cpfCnpj,
      asaasCustomerId: data.asaasCustomerId ?? undefined,
      subscriptionId: data.subscriptionId,
      subscriptionStatus: "active",
      subscriptionPlan: "manager_base",
      operatorCount: data.operatorCount,
      subscriptionStartDate: data.subscriptionStartDate,
      postalCode: data.postalCode ?? undefined,
      address: data.address ?? undefined,
      addressNumber: data.addressNumber ?? undefined,
      neighborhood: data.neighborhood ?? undefined,
      complement: data.complement ?? undefined,
      city: data.city ?? undefined,
      state: data.state ?? undefined,
    }

    const profile = await prisma.$transaction(async (tx) => {
      const createdProfile = await tx.profile.create({ data: profileData })
      const team = await tx.team.create({
        data: {
          name: "Meu Time",
          masterId: createdProfile.id,
          isDefault: true,
        },
      })

      await tx.teamMember.create({
        data: {
          teamId: team.id,
          profileId: createdProfile.id,
          role: "manager",
          functions: createdProfile.functions ?? [],
        },
      })

      await tx.profile.update({
        where: { id: createdProfile.id },
        data: { activeTeamId: team.id },
      })

      return createdProfile
    })

    return { profileId: profile.id, supabaseId: data.supabaseId }
  }

  async activateCreatedProfileSubscription(
    profileId: string,
    data: {
      subscriptionEndDate: Date
      subscriptionCycle: string
      subscriptionNextDueDate: Date
      canCreateAccountUsers: boolean
      canManageAccountTeams: boolean
    }
  ): Promise<void> {
    await prisma.profile.update({
      where: { id: profileId },
      data,
    })
  }

  async getOptions(): Promise<BackofficeAdhesionOptions> {
    const [leads, users] = await Promise.all([
      prisma.backofficeLead.findMany({
        where: {
          status: { in: [...eligibleLeadStatuses] },
          adhesion: null,
        },
        select: backofficeAdhesionLeadSelect,
        orderBy: { updatedAt: "desc" },
      }),
      prisma.backofficeUser.findMany({
        where: { isActive: true },
        select: backofficeAdhesionUserSelect,
        orderBy: { profile: { fullName: "asc" } },
      }),
    ])

    return { leads, users }
  }
}
