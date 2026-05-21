import type { SubscriptionPlan } from "@prisma/client"
import { Output } from "@/lib/output"
import { BackofficeAllUsersRepository } from "@/app/api/infra/data/repositories/backoffice/AllUsersRepository/BackofficeAllUsersRepository"
import type {
  BackofficeAllUsersFiltersInput,
  BackofficeAllUsersListRecord,
  BackofficeAllUsersMasterRef,
  BackofficeAllUsersPlanFilter,
  BackofficeAllUsersRoleFilter,
  IBackofficeAllUsersRepository,
} from "@/app/api/infra/data/repositories/backoffice/AllUsersRepository/IBackofficeAllUsersRepository"

export type { BackofficeAllUsersPlanFilter, BackofficeAllUsersRoleFilter }

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

function serializeListItem(record: BackofficeAllUsersListRecord) {
  return {
    id: record.id,
    fullName: record.fullName,
    email: record.email,
    phone: record.phone,
    role: record.role,
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
      const totalPages = Math.max(1, Math.ceil(result.totalItems / pageSize))

      return new Output(true, [], [], {
        items: result.items.map(serializeListItem),
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

      return new Output(true, [], [], {
        ...serializeListItem(detail),
        googleEmail: detail.googleEmail,
        teams: detail.teams.map((team) => ({
          id: team.id,
          name: team.name,
          createdAt: team.createdAt.toISOString(),
          membersCount: team.membersCount,
          masterId: team.masterId,
          masterFullName: team.masterFullName,
        })),
      })
    } catch (error) {
      console.error("[BackofficeAllUsersUseCase][getDetail]", error)
      return new Output(false, [], ["Erro ao carregar detalhes do usuário"], null)
    }
  }
}

export const backofficeAllUsersUseCase = new BackofficeAllUsersUseCase(
  new BackofficeAllUsersRepository()
)
