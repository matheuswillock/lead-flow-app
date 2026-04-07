import type { SubscriptionPlan } from "@prisma/client"
import { Output } from "@/lib/output"
import { asaasApi, asaasFetch } from "@/lib/asaas"
import type { IBackofficePlatformUsersRepository } from "@/app/api/infra/data/repositories/backoffice/IBackofficePlatformUsersRepository"
import type { IBackofficePlatformUsersUseCase } from "./IBackofficePlatformUsersUseCase"

interface PlanInfo {
  label: string
  amount: number | null
  kind: "lifetime" | "monthly" | "trial" | "none"
}

interface AsaasPaymentItem {
  id: string
  customer?: string
  dateCreated?: string
  value?: number
  netValue?: number
  originalValue?: number
  interestValue?: number
  billingType?: string
  status?: string
  dueDate?: string
  description?: string
  invoiceUrl?: string
  bankSlipUrl?: string
  transactionReceiptUrl?: string
  externalReference?: string
  installmentNumber?: number
  confirmedDate?: string
  deleted?: boolean
  clientPaymentDate?: string
  paymentDate?: string
  invoiceNumber?: string
  pixTransaction?: {
    transactionReceiptUrl?: string
  }
}

const CHARGED_STATUSES = new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"])
const UPCOMING_STATUSES = new Set(["PENDING", "AWAITING_RISK_ANALYSIS"])
const OVERDUE_STATUSES = new Set(["OVERDUE"])

type InvoiceStatusFilter = "all" | "paid" | "overdue" | "upcoming"
type InvoicePeriodFilter = "all" | "7d" | "30d" | "90d" | "this_month"

function normalizeAsaasValue(value: unknown): number {
  if (typeof value === "number") return value
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function normalizeStatusFilter(status?: string): InvoiceStatusFilter {
  if (status === "paid" || status === "overdue" || status === "upcoming") {
    return status
  }
  return "all"
}

function normalizePeriodFilter(period?: string): InvoicePeriodFilter {
  if (period === "7d" || period === "30d" || period === "90d" || period === "this_month") {
    return period
  }
  return "all"
}

function getStatusGroup(status?: string): "paid" | "overdue" | "upcoming" | "other" {
  if (status && CHARGED_STATUSES.has(status)) return "paid"
  if (status && OVERDUE_STATUSES.has(status)) return "overdue"
  if (status && UPCOMING_STATUSES.has(status)) return "upcoming"
  return "other"
}

function matchesStatusFilter(status: string | undefined, filter: InvoiceStatusFilter): boolean {
  if (filter === "all") return true
  return getStatusGroup(status) === filter
}

function getPeriodStartDate(period: InvoicePeriodFilter, now: Date): Date | null {
  if (period === "all") {
    return null
  }

  if (period === "this_month") {
    return new Date(now.getFullYear(), now.getMonth(), 1)
  }

  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90
  const start = new Date(now)
  start.setDate(start.getDate() - days)
  return new Date(start.getFullYear(), start.getMonth(), start.getDate())
}

function matchesPeriodFilter(
  dueDate: string | undefined,
  period: InvoicePeriodFilter,
  now: Date
): boolean {
  const start = getPeriodStartDate(period, now)
  if (!start) return true
  if (!dueDate) return false

  const due = new Date(`${dueDate}T00:00:00`)
  if (Number.isNaN(due.getTime())) return false

  return due >= start
}

function getSortableInvoiceDate(payment: AsaasPaymentItem): number {
  const reference = payment.dueDate ?? payment.dateCreated
  if (!reference) return 0
  const date = new Date(reference)
  return Number.isNaN(date.getTime()) ? 0 : date.getTime()
}

function getMonthlyPlanAmount(plan: SubscriptionPlan | null, operatorCount: number): number | null {
  if (plan === "manager_base") return 59.9
  if (plan === "with_operators") return 59.9 + Math.max(operatorCount, 0) * 19.9
  return null
}

function getPlanInfo(
  hasPermanentSubscription: boolean,
  subscriptionPlan: SubscriptionPlan | null,
  operatorCount: number
): PlanInfo {
  if (hasPermanentSubscription) {
    return {
      label: "Vitalício",
      amount: null,
      kind: "lifetime",
    }
  }

  if (subscriptionPlan === "free_trial") {
    return {
      label: "Trial",
      amount: null,
      kind: "trial",
    }
  }

  const amount = getMonthlyPlanAmount(subscriptionPlan, operatorCount)
  if (amount !== null) {
    return {
      label: "Mensal",
      amount,
      kind: "monthly",
    }
  }

  return {
    label: "Sem plano ativo",
    amount: null,
    kind: "none",
  }
}

export class BackofficePlatformUsersUseCase implements IBackofficePlatformUsersUseCase {
  constructor(private readonly platformUsersRepository: IBackofficePlatformUsersRepository) {}

  private async fetchAllCustomerPayments(customerId: string): Promise<AsaasPaymentItem[]> {
    const limit = 100
    let offset = 0
    let totalCount: number | null = null
    const items: AsaasPaymentItem[] = []

    for (let iteration = 0; iteration < 30; iteration += 1) {
      const params = new URLSearchParams({
        customer: customerId,
        offset: String(offset),
        limit: String(limit),
      })

      const asaasResponse = await asaasFetch(`${asaasApi.payments}?${params.toString()}`, {
        method: "GET",
      })

      const chunk = Array.isArray(asaasResponse?.data)
        ? (asaasResponse.data as AsaasPaymentItem[])
        : []

      if (totalCount === null && Number.isFinite(Number(asaasResponse?.totalCount))) {
        totalCount = Number(asaasResponse.totalCount)
      }

      if (chunk.length === 0) {
        break
      }

      items.push(...chunk)
      offset += chunk.length

      if (chunk.length < limit) {
        break
      }

      if (totalCount !== null && offset >= totalCount) {
        break
      }
    }

    return items
  }

  async listMasterUsers(
    filters: { name?: string; email?: string; team?: string } | undefined,
    pagination: { page: number; pageSize: number }
  ): Promise<Output> {
    try {
      const page = Math.max(pagination.page || 1, 1)
      const pageSize = Math.max(pagination.pageSize || 10, 5)

      const mastersResult = await this.platformUsersRepository.findMasterUsersWithFilters(filters, {
        page,
        pageSize,
      })

      const items = mastersResult.items.map((master) => {
        const plan = getPlanInfo(
          master.hasPermanentSubscription,
          master.subscriptionPlan,
          master.operatorCount
        )

        return {
          id: master.id,
          fullName: master.fullName,
          email: master.email,
          phone: master.phone,
          profileIconUrl: master.profileIconUrl,
          createdAt: master.createdAt,
          teamsCount: master.teamsCount,
          linkedUsersCount: master.linkedUsersCount,
          plan,
          teams: master.teams,
        }
      })

      const totalPages = Math.max(1, Math.ceil(mastersResult.totalItems / pageSize))

      const result = {
        items,
        pagination: {
          page,
          pageSize,
          totalItems: mastersResult.totalItems,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      }

      return new Output(true, [], [], result)
    } catch (error) {
      console.error("[BackofficePlatformUsersUseCase][listMasterUsers]", error)
      return new Output(false, [], ["Erro ao listar usuários da plataforma"], null)
    }
  }

  async getMasterUserDetails(
    masterProfileId: string,
    options: { query?: string; page: number; pageSize: number }
  ): Promise<Output> {
    try {
      const page = Math.max(options.page || 1, 1)
      const pageSize = Math.max(options.pageSize || 10, 5)

      const master = await this.platformUsersRepository.findMasterUserDetailsById(masterProfileId, {
        query: options.query,
        page,
        pageSize,
      })

      if (!master) {
        return new Output(false, [], ["Usuário master não encontrado"], null)
      }

      const plan = getPlanInfo(
        master.hasPermanentSubscription,
        master.subscriptionPlan,
        master.operatorCount
      )

      return new Output(true, [], [], {
        id: master.id,
        fullName: master.fullName,
        email: master.email,
        phone: master.phone,
        profileIconUrl: master.profileIconUrl,
        createdAt: master.createdAt,
        linkedUsersCount: master.linkedUsersCount,
        plan,
        teams: master.teams,
        teamsPagination: {
          page,
          pageSize,
          totalItems: master.teamsTotalItems,
          totalPages: Math.max(1, Math.ceil(master.teamsTotalItems / pageSize)),
          hasNextPage: page < Math.max(1, Math.ceil(master.teamsTotalItems / pageSize)),
          hasPreviousPage: page > 1,
        },
      })
    } catch (error) {
      console.error("[BackofficePlatformUsersUseCase][getMasterUserDetails]", error)
      return new Output(false, [], ["Erro ao carregar detalhes do usuário master"], null)
    }
  }

  async getMasterUserInvoices(
    masterProfileId: string,
    options: {
      page: number
      pageSize: number
      status?: string
      period?: string
    }
  ): Promise<Output> {
    try {
      const page = Math.max(options.page || 1, 1)
      const pageSize = Math.max(options.pageSize || 10, 5)
      const statusFilter = normalizeStatusFilter(options.status)
      const periodFilter = normalizePeriodFilter(options.period)

      const master = await this.platformUsersRepository.findMasterUserBillingById(masterProfileId)
      if (!master) {
        return new Output(false, [], ["Usuário master não encontrado"], null)
      }

      if (!master.asaasCustomerId) {
        return new Output(true, [], [], {
          items: [],
          pagination: {
            page,
            pageSize,
            totalItems: 0,
            totalPages: 1,
            hasNextPage: false,
            hasPreviousPage: false,
          },
          summary: {
            charged: 0,
            upcoming: 0,
            overdue: 0,
          },
          filters: {
            status: statusFilter,
            period: periodFilter,
          },
        })
      }

      const now = new Date()
      const allItems = await this.fetchAllCustomerPayments(master.asaasCustomerId)

      const filteredItems = allItems
        .filter((payment) => {
          if (!matchesStatusFilter(payment.status, statusFilter)) {
            return false
          }

          return matchesPeriodFilter(payment.dueDate, periodFilter, now)
        })
        .sort((a, b) => getSortableInvoiceDate(b) - getSortableInvoiceDate(a))

      const totalItems = filteredItems.length
      const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
      const safePage = Math.min(page, totalPages)
      const offset = (safePage - 1) * pageSize
      const pagedItems = filteredItems.slice(offset, offset + pageSize)

      const items = pagedItems.map((payment) => ({
        id: payment.id,
        status: payment.status ?? "PENDING",
        statusGroup: getStatusGroup(payment.status),
        value: normalizeAsaasValue(payment.value),
        dateCreated: payment.dateCreated ?? null,
        dueDate: payment.dueDate ?? null,
        paymentDate: payment.clientPaymentDate ?? payment.paymentDate ?? null,
        description: payment.description ?? "Descrição não informada",
        billingType: payment.billingType ?? "UNDEFINED",
        invoiceUrl: payment.invoiceUrl ?? null,
        bankSlipUrl: payment.bankSlipUrl ?? null,
        invoiceNumber: payment.invoiceNumber ?? null,
      }))

      const summary = filteredItems.reduce(
        (acc, item) => {
          const status = item.status ?? ""

          if (CHARGED_STATUSES.has(status)) {
            acc.charged += 1
          } else if (UPCOMING_STATUSES.has(status)) {
            acc.upcoming += 1
          } else if (status === "OVERDUE") {
            acc.overdue += 1
          }
          return acc
        },
        { charged: 0, upcoming: 0, overdue: 0 }
      )

      return new Output(true, [], [], {
        items,
        pagination: {
          page: safePage,
          pageSize,
          totalItems,
          totalPages,
          hasNextPage: safePage < totalPages,
          hasPreviousPage: safePage > 1,
        },
        summary,
        filters: {
          status: statusFilter,
          period: periodFilter,
        },
      })
    } catch (error) {
      console.error("[BackofficePlatformUsersUseCase][getMasterUserInvoices]", error)
      return new Output(false, [], ["Erro ao carregar faturas do cliente"], null)
    }
  }

  async getMasterUserInvoiceById(masterProfileId: string, invoiceId: string): Promise<Output> {
    try {
      if (!invoiceId || invoiceId.trim().length === 0) {
        return new Output(false, [], ["ID da fatura é obrigatório"], null)
      }

      const master = await this.platformUsersRepository.findMasterUserBillingById(masterProfileId)
      if (!master) {
        return new Output(false, [], ["Usuário master não encontrado"], null)
      }

      if (!master.asaasCustomerId) {
        return new Output(false, [], ["Usuário não possui cliente Asaas vinculado"], null)
      }

      const payment = (await asaasFetch(`${asaasApi.payments}/${invoiceId}`, {
        method: "GET",
      })) as AsaasPaymentItem

      if (!payment?.id) {
        return new Output(false, [], ["Fatura não encontrada"], null)
      }

      if (payment.customer && payment.customer !== master.asaasCustomerId) {
        return new Output(false, [], ["Fatura não pertence ao cliente selecionado"], null)
      }

      return new Output(true, [], [], {
        id: payment.id,
        customerName: master.fullName ?? master.email,
        status: payment.status ?? "PENDING",
        statusGroup: getStatusGroup(payment.status),
        value: normalizeAsaasValue(payment.value),
        netValue: normalizeAsaasValue(payment.netValue),
        originalValue: normalizeAsaasValue(payment.originalValue),
        interestValue: normalizeAsaasValue(payment.interestValue),
        billingType: payment.billingType ?? "UNDEFINED",
        description: payment.description ?? "Descrição não informada",
        dateCreated: payment.dateCreated ?? null,
        dueDate: payment.dueDate ?? null,
        paymentDate: payment.clientPaymentDate ?? payment.paymentDate ?? null,
        confirmedDate: payment.confirmedDate ?? null,
        invoiceNumber: payment.invoiceNumber ?? null,
        installmentNumber: payment.installmentNumber ?? null,
        externalReference: payment.externalReference ?? null,
        invoiceUrl: payment.invoiceUrl ?? null,
        bankSlipUrl: payment.bankSlipUrl ?? null,
        transactionReceiptUrl:
          payment.transactionReceiptUrl ?? payment.pixTransaction?.transactionReceiptUrl ?? null,
        deleted: Boolean(payment.deleted),
      })
    } catch (error) {
      console.error("[BackofficePlatformUsersUseCase][getMasterUserInvoiceById]", error)
      return new Output(false, [], ["Erro ao carregar detalhes da fatura"], null)
    }
  }
}
