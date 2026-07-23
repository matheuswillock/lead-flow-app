import type { Prisma } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import type {
  BackofficeWhatsAppInstanceRow,
  BackofficeWhatsAppTeamWithoutInstance,
  IBackofficeWhatsAppInstanceRepository,
  ListInstancesFilters,
} from "./IBackofficeWhatsAppInstanceRepository"

const INSTANCE_SELECT = {
  id: true,
  teamId: true,
  provider: true,
  instanceName: true,
  instanceId: true,
  phoneNumber: true,
  displayName: true,
  status: true,
  qrCodeText: true,
  qrCodeImageUrl: true,
  webhookSecret: true,
  lastConnectedAt: true,
  lastDisconnectedAt: true,
  lastSyncAt: true,
  historySyncStatus: true,
  historySyncStartedAt: true,
  historySyncCompletedAt: true,
  historySyncError: true,
  usageLimitMonthly: true,
  billingEnabled: true,
  createdAt: true,
  updatedAt: true,
  team: {
    select: {
      id: true,
      name: true,
      master: {
        select: {
          id: true,
          fullName: true,
          email: true,
          supabaseId: true,
        },
      },
    },
  },
} as const

function buildSearchFilter(q?: string): Prisma.TeamWhatsAppConfigWhereInput | undefined {
  const term = q?.trim()
  if (!term) return undefined

  return {
    OR: [
      { instanceName: { contains: term, mode: "insensitive" } },
      { phoneNumber: { contains: term, mode: "insensitive" } },
      { displayName: { contains: term, mode: "insensitive" } },
      { team: { name: { contains: term, mode: "insensitive" } } },
      { team: { master: { fullName: { contains: term, mode: "insensitive" } } } },
      { team: { master: { email: { contains: term, mode: "insensitive" } } } },
    ],
  }
}

function buildTeamSearchFilter(q?: string): Prisma.TeamWhereInput | undefined {
  const term = q?.trim()
  if (!term) return undefined

  return {
    OR: [
      { name: { contains: term, mode: "insensitive" } },
      { master: { fullName: { contains: term, mode: "insensitive" } } },
      { master: { email: { contains: term, mode: "insensitive" } } },
    ],
  }
}

class BackofficeWhatsAppInstanceRepository implements IBackofficeWhatsAppInstanceRepository {
  async listInstances(
    filters: ListInstancesFilters,
    pagination: { page: number; pageSize: number }
  ): Promise<{ items: BackofficeWhatsAppInstanceRow[]; totalItems: number }> {
    const page = Math.max(pagination.page, 1)
    const pageSize = Math.max(pagination.pageSize, 5)
    const skip = (page - 1) * pageSize

    const searchFilter = buildSearchFilter(filters.q)
    const where: Prisma.TeamWhatsAppConfigWhereInput = {
      ...(filters.status ? { status: filters.status } : {}),
      ...(searchFilter ?? {}),
    }

    const [items, totalItems] = await prisma.$transaction([
      prisma.teamWhatsAppConfig.findMany({
        where,
        select: INSTANCE_SELECT,
        orderBy: { updatedAt: "desc" },
        skip,
        take: pageSize,
      }),
      prisma.teamWhatsAppConfig.count({ where }),
    ])

    return { items, totalItems }
  }

  async findInstanceById(configId: string): Promise<BackofficeWhatsAppInstanceRow | null> {
    return prisma.teamWhatsAppConfig.findUnique({
      where: { id: configId },
      select: INSTANCE_SELECT,
    })
  }

  async findInstanceByTeamId(teamId: string): Promise<BackofficeWhatsAppInstanceRow | null> {
    return prisma.teamWhatsAppConfig.findUnique({
      where: { teamId },
      select: INSTANCE_SELECT,
    })
  }

  async listPrimaryWebhookResyncTargets() {
    return prisma.teamWhatsAppConfig.findMany({
      where: {
        primaryConfigId: null,
        webhookSecret: { not: "" },
        instanceName: { not: "" },
      },
      select: {
        id: true,
        teamId: true,
        instanceName: true,
        webhookSecret: true,
        status: true,
      },
      orderBy: { createdAt: "asc" },
    })
  }

  async updateInstanceAdminFields(
    configId: string,
    data: {
      usageLimitMonthly?: number
      billingEnabled?: boolean
      updatedByProfileId: string
    }
  ): Promise<BackofficeWhatsAppInstanceRow> {
    return prisma.teamWhatsAppConfig.update({
      where: { id: configId },
      data: {
        ...(data.usageLimitMonthly !== undefined
          ? { usageLimitMonthly: data.usageLimitMonthly }
          : {}),
        ...(data.billingEnabled !== undefined ? { billingEnabled: data.billingEnabled } : {}),
        updatedBy: { connect: { id: data.updatedByProfileId } },
      },
      select: INSTANCE_SELECT,
    })
  }

  async listTeamsWithoutConfig(
    filters: { q?: string },
    pagination: { page: number; pageSize: number }
  ): Promise<{ items: BackofficeWhatsAppTeamWithoutInstance[]; totalItems: number }> {
    const page = Math.max(pagination.page, 1)
    const pageSize = Math.max(pagination.pageSize, 5)
    const skip = (page - 1) * pageSize

    const searchFilter = buildTeamSearchFilter(filters.q)
    const where: Prisma.TeamWhereInput = {
      whatsappConfig: { is: null },
      ...(searchFilter ?? {}),
    }

    const [items, totalItems] = await prisma.$transaction([
      prisma.team.findMany({
        where,
        select: {
          id: true,
          name: true,
          master: {
            select: {
              id: true,
              fullName: true,
              email: true,
              supabaseId: true,
            },
          },
        },
        orderBy: { name: "asc" },
        skip,
        take: pageSize,
      }),
      prisma.team.count({ where }),
    ])

    return { items, totalItems }
  }
}

export const backofficeWhatsAppInstanceRepository = new BackofficeWhatsAppInstanceRepository()
