import type { SubscriptionPlan } from "@prisma/client"
import { createClient } from "@supabase/supabase-js"
import { Output } from "@/lib/output"
import { asaasApi, asaasFetch } from "@/lib/asaas"
import { createEmailService } from "@/lib/services/EmailService"
import { resolveBackofficeMemberAccess } from "@/lib/backoffice-member-access"
import { getAppUrl, getFullUrl } from "@/lib/utils/app-url"
import { buildSetPasswordEmailAuthLink } from "@/lib/supabase/email-auth-link"
import type { IBackofficePlatformUsersUseCase } from "./IBackofficePlatformUsersUseCase"
import {
  startOfMonthInTz,
  addDaysInTz,
  startOfDayInTz,
  DEFAULT_TZ,
  formatIntimezone,
  parseDateKeyToUtc,
  resolveTimezone,
} from "@/lib/dates"
import { IBackofficePlatformUsersRepository } from "../../infra/data/repositories/backoffice/PlatformUsersRepository/IBackofficePlatformUsersRepository"
import { BackofficePlatformUsersRepository } from "../../infra/data/repositories/backoffice/PlatformUsersRepository/BackofficePlatformUsersRepository"

function buildMasterNotificationEmail(params: {
  masterName: string
  userName: string
  userEmail: string
  roleLabel: string
}): string {
  const { masterName, userName, userEmail, roleLabel } = params
  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
      <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
      <body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
        <table role="presentation" style="width:100%;border-collapse:collapse;">
          <tr>
            <td align="center" style="padding:24px;">
              <table role="presentation" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;">
                <tr>
                  <td style="background:#ff6900;color:#ffffff;padding:24px;text-align:center;">
                    <h1 style="margin:0;font-size:22px;">Corretor Studio</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding:28px 24px;">
                    <h2 style="margin:0 0 12px 0;color:#171717;font-size:20px;">Novo usuário adicionado</h2>
                    <p style="margin:0 0 16px 0;color:#525252;line-height:1.5;">
                      Olá, <strong>${masterName}</strong>. Um novo usuário foi adicionado à sua conta.
                    </p>
                    <div style="background:#fafafa;border:1px solid #e5e5e5;border-radius:8px;padding:16px;margin:16px 0;">
                      <p style="margin:0 0 8px 0;color:#171717;"><strong>Nome:</strong> ${userName}</p>
                      <p style="margin:0 0 8px 0;color:#171717;"><strong>E-mail:</strong> ${userEmail}</p>
                      <p style="margin:0;color:#171717;"><strong>Papel:</strong> ${roleLabel}</p>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `
}

function buildAddedToTeamEmail(params: { userName: string; loginUrl: string }): string {
  const { userName, loginUrl } = params
  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
      <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
      <body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
        <table role="presentation" style="width:100%;border-collapse:collapse;">
          <tr>
            <td align="center" style="padding:24px;">
              <table role="presentation" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;">
                <tr>
                  <td style="background:#ff6900;color:#ffffff;padding:24px;text-align:center;">
                    <h1 style="margin:0;font-size:22px;">Corretor Studio</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding:28px 24px;">
                    <h2 style="margin:0 0 12px 0;color:#171717;font-size:20px;">Você foi adicionado a um novo time</h2>
                    <p style="margin:0 0 16px 0;color:#525252;line-height:1.5;">
                      Olá, <strong>${userName}</strong>. Você foi adicionado a um novo time no Corretor Studio.
                    </p>
                    <div style="margin-top:24px;">
                      <a href="${loginUrl}" style="display:inline-block;background:#ff6900;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:600;">
                        Acessar a plataforma
                      </a>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `
}

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

function createSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error("Supabase admin credentials não configuradas")
  return createClient(url, serviceKey)
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

function getPeriodStartDate(period: InvoicePeriodFilter, now: Date, timezone: string): Date | null {
  if (period === "all") {
    return null
  }

  if (period === "this_month") {
    return startOfMonthInTz(now, timezone)
  }

  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90
  return startOfDayInTz(addDaysInTz(now, -days, timezone), timezone)
}

function matchesPeriodFilter(
  dueDate: string | undefined,
  period: InvoicePeriodFilter,
  now: Date,
  timezone: string
): boolean {
  const start = getPeriodStartDate(period, now, timezone)
  if (!start) return true
  if (!dueDate) return false

  const due = parseDateKeyToUtc(dueDate, timezone)

  return due >= start
}

function getSortableInvoiceDate(payment: AsaasPaymentItem): number {
  const reference = payment.dueDate ?? payment.dateCreated
  if (!reference) return 0
  const date = new Date(reference)
  return Number.isNaN(date.getTime()) ? 0 : date.getTime()
}

function formatInvoiceDate(value: string | undefined, timezone: string): string {
  if (!value) return "não informada"
  return formatIntimezone(parseDateKeyToUtc(value, timezone), "dd/MM/yyyy", timezone)
}

function formatInvoiceCurrency(value?: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(normalizeAsaasValue(value))
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
    filters: { name?: string; email?: string; team?: string; plan?: "lifetime" | "monthly" | "trial" | "none"; userType?: "common" | "member_pro" } | undefined,
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

      const hasAccess =
        master.hasPermanentSubscription ||
        (!!master.subscriptionId && master.subscriptionStatus === "active")

      const accessByProfileId = await resolveBackofficeMemberAccess(
        master.teams.flatMap((team) =>
          team.members.map((member) => ({
            profileId: member.id,
            supabaseId: member.supabaseId,
            email: member.email,
            fullName: member.fullName,
            role: member.role as "manager" | "backoffice" | "operator",
            isMaster: member.isMaster,
            managerName: master.fullName ?? master.email,
          }))
        )
      )

      return new Output(true, [], [], {
        id: master.id,
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
        linkedUsersCount: master.linkedUsersCount,
        plan,
        subscription: {
          hasAccess,
          status: master.subscriptionStatus,
        },
        teams: master.teams.map((team) => ({
          id: team.id,
          name: team.name,
          createdAt: team.createdAt,
          membersCount: team.membersCount,
          transferRoutes: team.transferRoutes,
          members: team.members.map((member) => ({
            id: member.id,
            teamMemberId: member.teamMemberId,
            fullName: member.fullName,
            email: member.email,
            phone: member.phone,
            addedAt: member.addedAt,
            role: member.role,
            googleCalendarConnected: member.googleCalendarConnected,
            googleEmail: member.googleEmail,
            functions: member.functions,
            isMaster: member.isMaster,
            canCreateAccountUsers: member.canCreateAccountUsers,
            canManageAccountTeams: member.canManageAccountTeams,
            canTransferAccountLeads: member.canTransferAccountLeads,
            ...(accessByProfileId.get(member.id) ?? {
              accessStatus: "pending_first_access",
              hasCompletedFirstAccess: false,
              lastSignInAt: null,
            }),
          })),
        })),
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
      timezone?: string
    }
  ): Promise<Output> {
    try {
      const page = Math.max(options.page || 1, 1)
      const pageSize = Math.max(options.pageSize || 10, 5)
      const statusFilter = normalizeStatusFilter(options.status)
      const periodFilter = normalizePeriodFilter(options.period)
      const timezone = resolveTimezone(options.timezone ?? DEFAULT_TZ)

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

          return matchesPeriodFilter(payment.dueDate, periodFilter, now, timezone)
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

  async notifyMasterUserInvoiceStatusEmail(
    masterProfileId: string,
    invoiceId: string
  ): Promise<Output> {
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

      const statusGroup = getStatusGroup(payment.status)
      if (statusGroup !== "upcoming" && statusGroup !== "overdue") {
        return new Output(
          false,
          [],
          ["Notificação disponível apenas para faturas a vencer ou vencidas"],
          null
        )
      }

      const isOverdue = statusGroup === "overdue"
      const appUrl = getAppUrl({ removeTrailingSlash: true })
      const manageUrl = `${appUrl}/sign-in`
      const invoiceUrl = payment.invoiceUrl ?? manageUrl
      const invoiceNumber = payment.invoiceNumber ? `#${payment.invoiceNumber}` : payment.id
      const dueDate = formatInvoiceDate(payment.dueDate, DEFAULT_TZ)
      const value = formatInvoiceCurrency(payment.value)
      const customerName = master.fullName ?? master.email

      const subject = isOverdue
        ? "Corretor Studio - Sua assinatura está vencida"
        : "Corretor Studio - Sua assinatura está prestes a vencer"

      const html = `
        <!DOCTYPE html>
        <html lang="pt-BR">
          <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          </head>
          <body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
            <table role="presentation" style="width:100%;border-collapse:collapse;">
              <tr>
                <td align="center" style="padding:24px;">
                  <table role="presentation" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;">
                    <tr>
                      <td style="background:#ff6900;color:#ffffff;padding:24px;text-align:center;">
                        <h1 style="margin:0;font-size:22px;">Corretor Studio</h1>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:28px 24px;">
                        <h2 style="margin:0 0 12px 0;color:#171717;font-size:20px;">
                          ${isOverdue ? "Sua assinatura está vencida" : "Sua assinatura está prestes a vencer"}
                        </h2>
                        <p style="margin:0 0 16px 0;color:#525252;line-height:1.5;">
                          Olá, <strong>${customerName}</strong>. Identificamos a fatura <strong>${invoiceNumber}</strong>
                          ${isOverdue ? "em atraso" : "próxima do vencimento"}.
                        </p>

                        <div style="background:#fafafa;border:1px solid #e5e5e5;border-radius:8px;padding:16px;margin:16px 0;">
                          <p style="margin:0 0 8px 0;color:#171717;"><strong>Valor:</strong> ${value}</p>
                          <p style="margin:0 0 8px 0;color:#171717;"><strong>Vencimento:</strong> ${dueDate}</p>
                          <p style="margin:0;color:#171717;"><strong>Status:</strong> ${
                            isOverdue ? "Vencida" : "A vencer"
                          }</p>
                        </div>

                        <div style="margin-top:24px;">
                          <a href="${invoiceUrl}" style="display:inline-block;background:#ff6900;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:600;">
                            Visualizar fatura
                          </a>
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
        </html>
      `

      const emailService = createEmailService()
      const emailResult = await emailService.sendEmail({
        to: [master.email],
        subject,
        html,
      })

      if (!emailResult.success) {
        console.error("[BackofficePlatformUsersUseCase][notifyMasterUserInvoiceStatusEmail]", emailResult)
        return new Output(false, [], ["Não foi possível enviar o e-mail de notificação"], null)
      }

      return new Output(
        true,
        [
          isOverdue
            ? "Notificação de assinatura vencida enviada com sucesso"
            : "Notificação de assinatura prestes a vencer enviada com sucesso",
        ],
        [],
        {
          invoiceId: payment.id,
          statusGroup,
        }
      )
    } catch (error) {
      console.error("[BackofficePlatformUsersUseCase][notifyMasterUserInvoiceStatusEmail]", error)
      return new Output(false, [], ["Erro ao disparar notificação por e-mail"], null)
    }
  }

  async updateMasterUser(
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
    }
  ): Promise<Output> {
    try {
      if (data.fullName !== undefined) {
        const name = data.fullName.trim()
        if (name.length < 2) {
          return new Output(false, [], ["Nome completo deve ter pelo menos 2 caracteres"], null)
        }
        data = { ...data, fullName: name }
      }

      if (data.state !== undefined && data.state !== null) {
        data = { ...data, state: data.state.toUpperCase().slice(0, 2) }
      }

      const updated = await this.platformUsersRepository.updateMasterUserProfile(masterProfileId, data)
      if (!updated) {
        return new Output(false, [], ["Usuário master não encontrado ou não foi possível atualizar"], null)
      }

      return new Output(true, ["Dados atualizados com sucesso"], [], { id: updated.id })
    } catch (error) {
      console.error("[BackofficePlatformUsersUseCase][updateMasterUser]", error)
      return new Output(false, [], ["Erro ao atualizar dados do cliente"], null)
    }
  }

  async deleteMasterUser(masterProfileId: string): Promise<Output> {
    try {
      const master = await this.platformUsersRepository.findMasterUserForDeletion(masterProfileId)
      if (!master) {
        return new Output(false, [], ["Usuário master não encontrado"], null)
      }

      const emailService = createEmailService()
      const recipients = [
        { fullName: master.fullName, email: master.email },
        ...master.managers,
      ]

      await Promise.all(
        recipients.map(async (recipient) => {
          try {
            await emailService.sendAccountDeletionFarewellEmail({
              userName: recipient.fullName ?? recipient.email,
              userEmail: recipient.email,
            })
          } catch (emailError) {
            console.error("[BackofficePlatformUsersUseCase][deleteMasterUser] Erro ao enviar e-mail para", recipient.email, emailError)
          }
        })
      )

      const { masterSupabaseId, memberSupabaseIds } =
        await this.platformUsersRepository.deleteMasterUserWithAllMembers(masterProfileId)

      const supabaseAdmin = createSupabaseAdmin()
      const allSupabaseIds = [
        ...(masterSupabaseId ? [masterSupabaseId] : []),
        ...memberSupabaseIds,
      ]

      await Promise.all(
        allSupabaseIds.map(async (supabaseId) => {
          try {
            await supabaseAdmin.auth.admin.deleteUser(supabaseId)
          } catch (authError) {
            console.error("[BackofficePlatformUsersUseCase][deleteMasterUser] Erro ao excluir supabaseId", supabaseId, authError)
          }
        })
      )

      console.info("[BackofficePlatformUsersUseCase][deleteMasterUser] Conta excluída:", master.email)
      return new Output(true, ["Conta excluída com sucesso"], [], { id: masterProfileId })
    } catch (error) {
      console.error("[BackofficePlatformUsersUseCase][deleteMasterUser]", error)
      return new Output(false, [], ["Erro ao excluir conta do cliente"], null)
    }
  }

  async addMemberToMasterUser(
    masterProfileId: string,
    data: {
      fullName: string
      email: string
      phone?: string | null
      role: "manager" | "backoffice" | "operator"
      functions: ("SDR" | "CLOSER")[]
      teamId: string
      canCreateAccountUsers?: boolean
      canManageAccountTeams?: boolean
      canTransferAccountLeads?: boolean
    }
  ): Promise<Output> {
    try {
      const trimmedName = data.fullName.trim()
      if (trimmedName.length < 2) {
        return new Output(false, [], ["Nome completo deve ter pelo menos 2 caracteres"], null)
      }

      const email = data.email.trim().toLowerCase()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return new Output(false, [], ["E-mail inválido"], null)
      }

      if (!data.teamId?.trim()) {
        return new Output(false, [], ["Time é obrigatório"], null)
      }

      const master = await this.platformUsersRepository.findMasterUserBillingById(masterProfileId)
      if (!master) {
        return new Output(false, [], ["Usuário master não encontrado"], null)
      }

      const team = await this.platformUsersRepository.findTeamByIdAndMasterId(data.teamId, masterProfileId)
      if (!team) {
        return new Output(false, [], ["Time não encontrado ou não pertence ao master selecionado"], null)
      }

      const existingProfile = await this.platformUsersRepository.findProfileByEmail(email)

      const emailService = createEmailService()
      const appUrl = getAppUrl({ removeTrailingSlash: true })
      const roleLabels: Record<string, string> = {
        manager: "Gerente",
        backoffice: "Backoffice",
        operator: "Operador",
      }
      const roleLabel = roleLabels[data.role] ?? data.role

      const delegatedPermissions = {
        canCreateAccountUsers: data.role === "manager" && data.canCreateAccountUsers === true,
        canManageAccountTeams: data.role === "manager" && data.canManageAccountTeams === true,
        canTransferAccountLeads:
          (data.role === "manager" || data.role === "backoffice") &&
          data.canTransferAccountLeads === true,
      }

      if (existingProfile) {
        if (existingProfile.isMaster) {
          return new Output(false, [], ["Este e-mail já possui uma conta master na plataforma"], null)
        }

        await this.platformUsersRepository.addExistingProfileToTeam(existingProfile.id, data.teamId, data.role, data.functions, delegatedPermissions)

        await emailService.sendEmail({
          to: [email],
          subject: "Corretor Studio - Você foi adicionado a um novo time",
          html: buildAddedToTeamEmail({ userName: trimmedName, loginUrl: `${appUrl}/sign-in` }),
        }).catch((err: unknown) => {
          console.error("[BackofficePlatformUsersUseCase][addMemberToMasterUser] Erro ao enviar e-mail ao usuário existente:", err)
        })

        await emailService.sendEmail({
          to: [master.email],
          subject: "Corretor Studio - Novo usuário adicionado",
          html: buildMasterNotificationEmail({ masterName: master.fullName ?? master.email, userName: trimmedName, userEmail: email, roleLabel }),
        }).catch((err: unknown) => {
          console.error("[BackofficePlatformUsersUseCase][addMemberToMasterUser] Erro ao enviar e-mail ao master:", err)
        })

        console.info("[BackofficePlatformUsersUseCase][addMemberToMasterUser] Usuário existente adicionado ao time:", email)
        return new Output(true, ["Usuário adicionado ao time com sucesso"], [], { profileId: existingProfile.id })
      }

      const { profileId } = await this.platformUsersRepository.createMemberForMaster(
        masterProfileId,
        { ...data, fullName: trimmedName, email, phone: data.phone ?? null, ...delegatedPermissions },
        data.teamId
      )

      const supabaseAdmin = createSupabaseAdmin()
      const redirectTo = getFullUrl("/set-password")

      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: "invite",
        email,
        options: {
          redirectTo,
          data: { name: trimmedName, invited: true, first_access: true },
        },
      })

      if (linkError || !linkData?.properties?.action_link) {
        console.error("[BackofficePlatformUsersUseCase][addMemberToMasterUser] Erro ao gerar link:", linkError)
        return new Output(false, [], ["Erro ao gerar link de convite"], null)
      }

      const supabaseUserId = (linkData as { user?: { id?: string } })?.user?.id
      if (supabaseUserId) {
        await this.platformUsersRepository.updateSupabaseIdForProfile(profileId, supabaseUserId)
          .catch((err: unknown) => {
            console.error("[BackofficePlatformUsersUseCase][addMemberToMasterUser] Erro ao salvar supabaseId:", err)
          })
      }

      const inviteLink = buildSetPasswordEmailAuthLink(linkData, "invite")

      await emailService.sendOperatorInviteEmail({
        operatorName: trimmedName,
        operatorEmail: email,
        operatorRole: data.role,
        managerName: master.fullName ?? master.email,
        inviteUrl: inviteLink,
      })

      await emailService.sendEmail({
        to: [master.email],
        subject: "Corretor Studio - Novo usuário adicionado",
        html: buildMasterNotificationEmail({ masterName: master.fullName ?? master.email, userName: trimmedName, userEmail: email, roleLabel }),
      }).catch((err: unknown) => {
        console.error("[BackofficePlatformUsersUseCase][addMemberToMasterUser] Erro ao enviar e-mail ao master:", err)
      })

      console.info("[BackofficePlatformUsersUseCase][addMemberToMasterUser] Membro adicionado:", email)
      return new Output(true, ["Usuário convidado com sucesso"], [], { profileId })
    } catch (error) {
      console.error("[BackofficePlatformUsersUseCase][addMemberToMasterUser]", error)
      return new Output(false, [], ["Erro ao adicionar usuário"], null)
    }
  }

  async addTeamToMasterUser(
    masterProfileId: string,
    data: { name: string }
  ): Promise<Output> {
    try {
      const name = data.name.trim()
      if (name.length < 2) {
        return new Output(false, [], ["Nome do time deve ter pelo menos 2 caracteres"], null)
      }

      const master = await this.platformUsersRepository.findMasterUserBillingById(masterProfileId)
      if (!master) {
        return new Output(false, [], ["Usuário master não encontrado"], null)
      }

      const team = await this.platformUsersRepository.createTeamForMaster(masterProfileId, name)

      console.info("[BackofficePlatformUsersUseCase][addTeamToMasterUser] Time criado:", team.id)
      return new Output(true, ["Time criado com sucesso"], [], { teamId: team.id, name: team.name })
    } catch (error) {
      console.error("[BackofficePlatformUsersUseCase][addTeamToMasterUser]", error)
      return new Output(false, [], ["Erro ao criar time"], null)
    }
  }

  async updateTeamForMasterUser(
    masterProfileId: string,
    teamId: string,
    data: { name?: string; transferTargetTeamIds?: string[]; updatedBy?: string }
  ): Promise<Output> {
    try {
      const master = await this.platformUsersRepository.findMasterUserBillingById(masterProfileId)
      if (!master) {
        return new Output(false, [], ["Usuário master não encontrado"], null)
      }

      if (data.name !== undefined) {
        const name = data.name.trim()
        if (name.length < 2) {
          return new Output(false, [], ["Nome do time deve ter pelo menos 2 caracteres"], null)
        }
        const updated = await this.platformUsersRepository.updateTeam(teamId, masterProfileId, { name })
        if (!updated) {
          return new Output(false, [], ["Time não encontrado"], null)
        }
      }

      if (data.transferTargetTeamIds !== undefined) {
        await this.platformUsersRepository.syncTeamTransferRoutes(
          teamId,
          masterProfileId,
          data.transferTargetTeamIds,
          data.updatedBy ?? masterProfileId
        )
      }

      console.info("[BackofficePlatformUsersUseCase][updateTeamForMasterUser] Time atualizado:", teamId)
      return new Output(true, ["Time atualizado com sucesso"], [], { teamId })
    } catch (error) {
      console.error("[BackofficePlatformUsersUseCase][updateTeamForMasterUser]", error)
      return new Output(false, [], ["Erro ao atualizar time"], null)
    }
  }

  async deleteTeamFromMasterUser(
    masterProfileId: string,
    teamId: string
  ): Promise<Output> {
    try {
      const master = await this.platformUsersRepository.findMasterUserBillingById(masterProfileId)
      if (!master) {
        return new Output(false, [], ["Usuário master não encontrado"], null)
      }

      const team = await this.platformUsersRepository.findTeamByIdAndMasterId(teamId, masterProfileId)
      if (!team) {
        return new Output(false, [], ["Time não encontrado"], null)
      }

      await this.platformUsersRepository.deleteTeam(teamId, masterProfileId)

      console.info("[BackofficePlatformUsersUseCase][deleteTeamFromMasterUser] Time excluído:", teamId)
      return new Output(true, ["Time excluído com sucesso"], [], { teamId })
    } catch (error) {
      console.error("[BackofficePlatformUsersUseCase][deleteTeamFromMasterUser]", error)
      return new Output(false, [], ["Erro ao excluir time"], null)
    }
  }
}

export const backofficePlatformUsersUseCase = new BackofficePlatformUsersUseCase(
  new BackofficePlatformUsersRepository()
)
