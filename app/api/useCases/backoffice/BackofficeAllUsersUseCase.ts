import type { SubscriptionPlan } from "@prisma/client"
import { Output } from "@/lib/output"
import {
  getScheduleMeetingStatusLabel,
} from "@/lib/lead-meeting"
import { BackofficeAllUsersRepository } from "@/app/api/infra/data/repositories/backoffice/AllUsersRepository/BackofficeAllUsersRepository"
import { backofficeBannedUsersRepository } from "@/app/api/infra/data/repositories/backoffice/BannedUsersRepository/BackofficeBannedUsersRepository"
import { resolveBackofficeMemberAccess } from "@/lib/backoffice-member-access"
import { backofficeTermsAcceptanceRepository } from "@/app/api/infra/data/repositories/backoffice/termsAcceptance/BackofficeTermsAcceptanceRepository"
import type {
  BackofficeAllUsersFiltersInput,
  BackofficeAllUsersListRecord,
  BackofficeAllUsersMasterRef,
  BackofficeAllUsersPlanFilter,
  BackofficeAllUsersRoleFilter,
  BackofficeAllUsersScheduleFiltersInput,
  BackofficeAllUsersScheduleRecord,
  BackofficeAllUsersEmailDispatchFiltersInput,
  BackofficeAllUsersEmailDispatchRecord,
  BackofficeAllUsersUserTypeFilter,
  IBackofficeAllUsersRepository,
} from "@/app/api/infra/data/repositories/backoffice/AllUsersRepository/IBackofficeAllUsersRepository"

export type { BackofficeAllUsersPlanFilter, BackofficeAllUsersRoleFilter, BackofficeAllUsersUserTypeFilter }

interface PlanInfo {
  label: string
  amount: number | null
  kind: "lifetime" | "monthly" | "trial" | "none"
}

function getMonthlyPlanAmount(plan: SubscriptionPlan | null, operatorCount: number): number | null {
  if (plan === "manager_base") return 59.9
  if (plan === "with_operators") return 59.9 + Math.max(operatorCount, 0) * 19.9
  return null
}

function getPlanInfo(master: BackofficeAllUsersMasterRef | null): PlanInfo {
  if (!master) return { label: "—", amount: null, kind: "none" }

  if (master.hasPermanentSubscription) {
    return { label: "Vitalício", amount: null, kind: "lifetime" }
  }

  if (master.subscriptionPlan === "free_trial") {
    return { label: "Trial", amount: null, kind: "trial" }
  }

  const amount = getMonthlyPlanAmount(master.subscriptionPlan, master.operatorCount)
  if (amount !== null) {
    return { label: "Mensal", amount, kind: "monthly" }
  }

  return { label: "Sem plano ativo", amount: null, kind: "none" }
}

function serializeListItem(
  record: BackofficeAllUsersListRecord,
  banInfo?: { isBanned: boolean; activeBanId: string | null; banScope: string | null }
) {
  const serializedFunctions = record.functions.map((func) => ({
    name: func,
    label: func === "CLOSER" ? "Closer" : "SDR",
  }))

  return {
    id: record.id,
    fullName: record.fullName,
    email: record.email,
    phone: record.phone,
    role: record.role,
    functions: serializedFunctions,
    isMaster: record.isMaster,
    googleCalendarConnected: record.googleCalendarConnected,
    createdAt: record.createdAt.toISOString(),
    master: record.master
      ? {
          id: record.master.id,
          fullName: record.master.fullName,
          plan: getPlanInfo(record.master),
        }
      : null,
    userType: record.userType,
    isBanned: banInfo?.isBanned ?? false,
    activeBanId: banInfo?.activeBanId ?? null,
    banScope: banInfo?.banScope ?? null,
  }
}

function serializeScheduleItem(record: BackofficeAllUsersScheduleRecord) {
  return {
    id: record.id,
    source: record.source,
    role: record.role,
    date: record.date.toISOString(),
    meetingTitle: record.meetingTitle,
    meetingLink: record.meetingLink,
    notes: record.notes,
    isCanceled: record.isCanceled,
    meetingStatus: record.meetingStatus,
    meetingStatusLabel: getScheduleMeetingStatusLabel(record.meetingStatus),
    createdAt: record.createdAt.toISOString(),
    sdr: record.sdr,
    closer: record.closer,
    transfer: record.transfer
      ? {
          ...record.transfer,
          transferredAt: record.transfer.transferredAt?.toISOString() ?? null,
        }
      : null,
    lead: {
      id: record.lead.id,
      name: record.lead.name,
      email: record.lead.email,
      phone: record.lead.phone,
      status: record.lead.status,
      meetingHeald: record.lead.meetingHeald,
    },
  }
}

function serializeEmailDispatchItem(record: BackofficeAllUsersEmailDispatchRecord) {
  return {
    id: record.id,
    recipientEmail: record.recipientEmail,
    recipientKind: record.recipientKind,
    provider: record.provider,
    category: record.category,
    subject: record.subject,
    status: record.status,
    errorMessage: record.errorMessage,
    sentAt: record.sentAt?.toISOString() ?? null,
    deliveredAt: record.deliveredAt?.toISOString() ?? null,
    openedAt: record.openedAt?.toISOString() ?? null,
    clickedAt: record.clickedAt?.toISOString() ?? null,
    bouncedAt: record.bouncedAt?.toISOString() ?? null,
    complainedAt: record.complainedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    events: record.events.map((event) => ({
      id: event.id,
      type: event.type,
      occurredAt: event.occurredAt.toISOString(),
    })),
  }
}

export class BackofficeAllUsersUseCase {
  constructor(private readonly repository: IBackofficeAllUsersRepository) {}

  async list(input: {
    filters?: BackofficeAllUsersFiltersInput
    page?: number
    pageSize?: number
  }): Promise<Output> {
    try {
      const page = Math.max(input.page ?? 1, 1)
      const pageSize = Math.min(Math.max(input.pageSize ?? 10, 5), 100)

      const result = await this.repository.list(input.filters ?? {}, { page, pageSize })
      const banByProfileId = await backofficeBannedUsersRepository.findActiveBansByProfileIds(
        result.items.map((item) => item.id)
      )
      const accessByProfileId = await resolveBackofficeMemberAccess(
        result.items.map((item) => ({
          profileId: item.id,
          supabaseId: item.supabaseId,
          email: item.email,
          fullName: item.fullName,
          role: item.role,
          isMaster: item.isMaster,
          managerName: item.master?.fullName ?? null,
        }))
      )
      const totalPages = Math.max(1, Math.ceil(result.totalItems / pageSize))

      return new Output(true, [], [], {
        items: result.items.map((item) => {
          const ban = banByProfileId.get(item.id)
          return {
            ...serializeListItem(item, {
              isBanned: Boolean(ban),
              activeBanId: ban?.id ?? null,
              banScope: ban?.scope ?? null,
            }),
            ...(accessByProfileId.get(item.id) ?? {
              accessStatus: "pending_first_access",
              hasCompletedFirstAccess: false,
              lastSignInAt: null,
            }),
          }
        }),
        pagination: {
          page,
          pageSize,
          totalItems: result.totalItems,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      })
    } catch (error) {
      console.error("[BackofficeAllUsersUseCase][list]", error)
      return new Output(false, [], ["Erro ao carregar usuários"], null)
    }
  }

  async getDetail(profileId: string): Promise<Output> {
    try {
      const detail = await this.repository.findDetailById(profileId)
      if (!detail) {
        return new Output(false, [], ["Usuário não encontrado"], null)
      }

      const accessByProfileId = await resolveBackofficeMemberAccess([
        {
          profileId: detail.id,
          supabaseId: detail.supabaseId,
          email: detail.email,
          fullName: detail.fullName,
          role: detail.role,
          isMaster: detail.isMaster,
          managerName: detail.master?.fullName ?? null,
        },
      ])

      const [activeBan, adhesion] = await Promise.all([
        backofficeBannedUsersRepository.findActiveByProfileId(profileId),
        backofficeTermsAcceptanceRepository.findActivationPipeline(profileId),
      ])

      const terminalAdhesion = adhesion && ["overdue", "expired", "canceled"].includes(adhesion.status)
      const activationDates = adhesion
        ? [adhesion.createdAt, adhesion.paidAt, adhesion.termsAcceptance?.acceptedAt ?? null, adhesion.firstPlatformAccessAt]
        : []
      const activationLabels = ["Nova adesão", "Pago", "Aceite", "Primeiro acesso"] as const
      const activationPipeline = adhesion
        ? {
            adhesionId: adhesion.id,
            adhesionStatus: adhesion.status,
            protocol: adhesion.termsAcceptance?.protocol ?? null,
            evidenceAvailable: Boolean(adhesion.termsAcceptance?.pdfStoragePath),
            hasProcessingFailure: Boolean(adhesion.termsAcceptance?.outbox.some((item) => item.status === "failed")),
            steps: activationLabels.map((label, index) => {
              const date = activationDates[index]
              const previousComplete = activationDates.slice(0, index).every(Boolean)
              const state = date ? "completed" : terminalAdhesion ? "blocked" : previousComplete ? "current" : "pending"
              return { key: ["created", "paid", "accepted", "first_access"][index], label, state, occurredAt: date?.toISOString() ?? null }
            }),
          }
        : null

      return new Output(true, [], [], {
        ...serializeListItem(detail, {
          isBanned: Boolean(activeBan),
          activeBanId: activeBan?.id ?? null,
          banScope: activeBan?.scope ?? null,
        }),
        ...(accessByProfileId.get(detail.id) ?? {
          accessStatus: "pending_first_access",
          hasCompletedFirstAccess: false,
          lastSignInAt: null,
        }),
        googleEmail: detail.googleEmail,
        teams: detail.teams.map((team) => ({
          id: team.id,
          name: team.name,
          createdAt: team.createdAt.toISOString(),
          membersCount: team.membersCount,
          masterId: team.masterId,
          masterFullName: team.masterFullName,
        })),
        activationPipeline,
      })
    } catch (error) {
      console.error("[BackofficeAllUsersUseCase][getDetail]", error)
      return new Output(false, [], ["Erro ao carregar detalhes do usuário"], null)
    }
  }

  async getSchedules(
    profileId: string,
    input: {
      filters?: BackofficeAllUsersScheduleFiltersInput
      page?: number
      pageSize?: number
    }
  ): Promise<Output> {
    try {
      const detail = await this.repository.findDetailById(profileId)
      if (!detail) {
        return new Output(false, [], ["Usuário não encontrado"], null)
      }

      const page = Math.max(input.page ?? 1, 1)
      const pageSize = Math.min(Math.max(input.pageSize ?? 10, 5), 100)

      const result = await this.repository.findSchedulesByProfileId(
        profileId,
        input.filters ?? {},
        { page, pageSize }
      )

      const totalPages = Math.max(1, Math.ceil(result.totalItems / pageSize))

      return new Output(true, [], [], {
        items: result.items.map(serializeScheduleItem),
        pagination: {
          page,
          pageSize,
          totalItems: result.totalItems,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      })
    } catch (error) {
      console.error("[BackofficeAllUsersUseCase][getSchedules]", error)
      return new Output(false, [], ["Erro ao carregar agendamentos do usuário"], null)
    }
  }

  async getEmailDispatches(
    profileId: string,
    input: {
      filters?: BackofficeAllUsersEmailDispatchFiltersInput
      page?: number
      pageSize?: number
    }
  ): Promise<Output> {
    try {
      const detail = await this.repository.findDetailById(profileId)
      if (!detail) {
        return new Output(false, [], ["Usuário não encontrado"], null)
      }

      const page = Math.max(input.page ?? 1, 1)
      const pageSize = Math.min(Math.max(input.pageSize ?? 10, 5), 100)

      const result = await this.repository.findEmailDispatchesByProfileId(
        profileId,
        input.filters ?? {},
        { page, pageSize }
      )

      const totalPages = Math.max(1, Math.ceil(result.totalItems / pageSize))

      return new Output(true, [], [], {
        items: result.items.map(serializeEmailDispatchItem),
        pagination: {
          page,
          pageSize,
          totalItems: result.totalItems,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      })
    } catch (error) {
      console.error("[BackofficeAllUsersUseCase][getEmailDispatches]", error)
      return new Output(false, [], ["Erro ao carregar e-mails disparados do usuário"], null)
    }
  }
}

export const backofficeAllUsersUseCase = new BackofficeAllUsersUseCase(
  new BackofficeAllUsersRepository()
)
