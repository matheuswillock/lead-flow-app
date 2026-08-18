import type { SubscriptionPlan } from "@prisma/client"
import { createSupabaseAdmin as createGuardedSupabaseAdmin } from "@/lib/supabase/server"
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
import { incrementalBillingService } from "../../services/billing/IncrementalBillingService"
import { memberProBillingUseCase } from "@/app/api/useCases/billing/MemberProBillingUseCase"
import type { BillingOwnerProfile } from "../../services/billing/IIncrementalBillingService"
import { backofficeIncrementalBillingCoordinator } from "./BackofficeIncrementalBillingCoordinator"
import { backofficeBannedUsersRepository } from "../../infra/data/repositories/backoffice/BannedUsersRepository/BackofficeBannedUsersRepository"
import { pendingActionRepository } from "@/app/api/infra/data/repositories/pendingAction/PendingActionRepository"
import { BackofficeAdhesionRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeAdhesion/BackofficeAdhesionRepository"
import {
  buildExternalInvoiceRowsFromAdhesion,
  parseAdhesionExternalInvoiceId,
  readInstallmentLedger,
} from "@/lib/backoffice-adhesions/installment-ledger"
import {
  buildPendingActionInvoiceId,
  classifyAsaasPaymentInvoice,
  classifyPendingActionInvoice,
  parsePendingActionInvoiceId,
} from "@/app/api/shared/billing/invoiceClassification"

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
      <body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
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
      <body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
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
  subscription?: string
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

type UnifiedInvoiceRow = {
  id: string
  invoiceIdDisplay: string
  invoiceName: string
  invoiceKind: "subscription" | "addon_user" | "addon_team" | "other"
  source: "asaas" | "pending_action" | "adhesion_external"
  status: string
  statusGroup: "paid" | "overdue" | "upcoming" | "other"
  value: number
  dateCreated: string | null
  dueDate: string | null
  paymentDate: string | null
  description: string
  billingType: string
  invoiceUrl: string | null
  bankSlipUrl: string | null
  invoiceNumber: string | null
  checkoutUrl: string | null
  pendingActionId: string | null
  sortDate: number
}

function readPayloadCharge(payload: Record<string, unknown>): number {
  const totalCharge = Number(payload.totalCharge ?? 0)
  if (Number.isFinite(totalCharge) && totalCharge > 0) return totalCharge
  const billingDelta = Number(payload.billingDelta ?? 0)
  return Number.isFinite(billingDelta) && billingDelta > 0 ? billingDelta : 0
}

function mapPendingActionStatus(action: {
  status: string
  paymentId: string | null
  payload: Record<string, unknown>
}): { status: string; statusGroup: "paid" | "overdue" | "upcoming" | "other" } {
  if (action.status === "pending") {
    return { status: "PENDING", statusGroup: "upcoming" }
  }
  if (action.status === "failed") {
    return { status: "FAILED", statusGroup: "other" }
  }
  if (action.status === "applied") {
    if (action.payload.paymentStatus === "WAIVED") {
      return { status: "WAIVED", statusGroup: "other" }
    }
    if (action.paymentId) {
      return { status: "CONFIRMED", statusGroup: "paid" }
    }
    return { status: "APPLIED", statusGroup: "other" }
  }
  return { status: action.status.toUpperCase(), statusGroup: "other" }
}

function readPayloadString(
  payload: Record<string, unknown>,
  keys: string[]
): string | null {
  for (const key of keys) {
    const value = payload[key]
    if (typeof value === "string" && value.trim()) {
      return value.trim()
    }
  }
  return null
}

/**
 * Pending-action creators store target identity under different keys:
 * - add_member: profileName / profileEmail
 * - add_user (legacy): operatorName / operatorEmail
 * - create_team: teamName / name
 * - some flows also persist plain name / email
 */
function resolvePendingActionTarget(payload: Record<string, unknown>): {
  name: string | null
  email: string | null
} {
  return {
    name: readPayloadString(payload, [
      "name",
      "profileName",
      "operatorName",
      "teamName",
    ]),
    email: readPayloadString(payload, [
      "email",
      "profileEmail",
      "operatorEmail",
    ]),
  }
}

function buildPendingActionDescription(actionType: string, payload: Record<string, unknown>): string {
  const { name, email } = resolvePendingActionTarget(payload)
  if (actionType === "create_team") {
    return name ? `Time: ${name}` : "Add-on time"
  }
  if (name && email) return `${name} (${email})`
  if (email) return email
  if (name) return name
  return "Add-on usuário"
}

function createSupabaseAdmin() {
  const client = createGuardedSupabaseAdmin()
  if (!client) {
    throw new Error(
      "Supabase admin indisponível: credenciais ausentes ou bloqueado no dev local (ver SUPABASE_LOCAL_ALLOW_REMOTE_ADMIN)"
    )
  }
  return client
}

const CHARGED_STATUSES = new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"])
const UPCOMING_STATUSES = new Set(["PENDING", "AWAITING_RISK_ANALYSIS"])
const OVERDUE_STATUSES = new Set(["OVERDUE"])
const CANCELABLE_ASAAS_STATUSES = new Set(["PENDING", "AWAITING_RISK_ANALYSIS", "OVERDUE"])

async function cancelOpenAsaasPayment(
  paymentId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const payment = (await asaasFetch(`${asaasApi.payments}/${paymentId}`, {
      method: "GET",
    })) as AsaasPaymentItem

    if (!payment?.id) {
      return { ok: true }
    }

    if (payment.deleted) {
      return { ok: true }
    }

    const paymentStatus = String(payment.status ?? "PENDING")
    if (CHARGED_STATUSES.has(paymentStatus)) {
      return {
        ok: false,
        error: `Cobrança Asaas ${paymentId} já está paga (${paymentStatus}); não é possível remover`,
      }
    }

    if (CANCELABLE_ASAAS_STATUSES.has(paymentStatus)) {
      await asaasFetch(`${asaasApi.payments}/${paymentId}`, { method: "DELETE" })
    }

    return { ok: true }
  } catch (error) {
    console.error(
      `[BackofficePlatformUsersUseCase][cancelOpenAsaasPayment] Falha ao cancelar ${paymentId}:`,
      error
    )
    return {
      ok: false,
      error: "Não foi possível cancelar a cobrança no Asaas",
    }
  }
}

function canSoftCancelPendingAction(action: {
  status: string
  payload: unknown
}): { ok: true } | { ok: false; error: string } {
  if (action.status === "canceled") {
    return { ok: true }
  }

  if (action.status === "applied") {
    const payload =
      action.payload && typeof action.payload === "object" && !Array.isArray(action.payload)
        ? (action.payload as Record<string, unknown>)
        : {}
    if (payload.paymentStatus !== "WAIVED") {
      return {
        ok: false,
        error: "Não é possível remover uma cobrança já aplicada/paga",
      }
    }
  }

  return { ok: true }
}

async function softCancelPendingAction(action: {
  id: string
  paymentId: string | null
  status: string
  payload: unknown
}): Promise<{ ok: true; alreadyCanceled: boolean } | { ok: false; error: string }> {
  const gate = canSoftCancelPendingAction(action)
  if (!gate.ok) {
    return gate
  }

  if (action.status === "canceled") {
    if (action.paymentId) {
      await pendingActionRepository.clearPaymentId(action.id)
    }
    return { ok: true, alreadyCanceled: true }
  }

  if (action.paymentId) {
    await pendingActionRepository.clearPaymentId(action.id)
  }
  await pendingActionRepository.updateStatus(action.id, "canceled")
  return { ok: true, alreadyCanceled: false }
}

async function resolvePendingActionLinkedToAsaasPayment(
  masterProfileId: string,
  payment: Pick<AsaasPaymentItem, "id" | "externalReference">
): Promise<{
  id: string
  masterId: string
  actionType: string
  status: string
  paymentId: string | null
  payload: unknown
} | null> {
  const fromExternal = parsePendingActionInvoiceId(payment.externalReference ?? "")
  if (fromExternal) {
    const byExternal = await pendingActionRepository.findByIdSimple(fromExternal)
    if (byExternal && byExternal.masterId === masterProfileId) {
      return byExternal
    }
  }

  if (!payment.id) {
    return null
  }

  const byPaymentId = await pendingActionRepository.findByPaymentId(payment.id)
  if (byPaymentId && byPaymentId.masterId === masterProfileId) {
    return byPaymentId
  }

  return null
}

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
  constructor(
    private readonly platformUsersRepository: IBackofficePlatformUsersRepository,
    private readonly adhesionRepository: BackofficeAdhesionRepository = new BackofficeAdhesionRepository()
  ) {}

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

      const accessByProfileId = await resolveBackofficeMemberAccess([
        {
          profileId: master.id,
          supabaseId: master.supabaseId,
          email: master.email,
          fullName: master.fullName,
          role: "manager",
          isMaster: true,
        },
        ...master.teams.flatMap((team) =>
          team.members.map((member) => ({
            profileId: member.id,
            supabaseId: member.supabaseId,
            email: member.email,
            fullName: member.fullName,
            role: member.role as "manager" | "backoffice" | "operator",
            isMaster: member.isMaster,
            managerName: master.fullName ?? master.email,
          }))
        ),
      ])

      const masterAccess =
        accessByProfileId.get(master.id) ?? {
          accessStatus: "pending_first_access" as const,
          hasCompletedFirstAccess: false,
          lastSignInAt: null,
        }

      const activeBan = await backofficeBannedUsersRepository.findActiveByProfileId(masterProfileId)

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
        accessStatus: masterAccess.accessStatus,
        hasCompletedFirstAccess: masterAccess.hasCompletedFirstAccess,
        lastSignInAt: masterAccess.lastSignInAt,
        userType: master.userType,
        hasUnlimitedUsers: master.hasUnlimitedUsers || master.hasPermanentSubscription,
        multiskillEnabled: master.multiskillEnabled,
        isBanned: Boolean(activeBan),
        allTeams: master.allTeams,
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
            canViewAllTeams: member.canViewAllTeams,
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

  async listMasterUserTeams(masterProfileId: string): Promise<Output> {
    try {
      const teams = await this.platformUsersRepository.listTeamsByMasterId(masterProfileId)
      if (!teams) {
        return new Output(false, [], ["Usuário master não encontrado"], null)
      }

      return new Output(true, [], [], teams)
    } catch (error) {
      console.error("[BackofficePlatformUsersUseCase][listMasterUserTeams]", error)
      return new Output(false, [], ["Erro ao listar times do master"], null)
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

      const now = new Date()
      const asaasPayments = master.asaasCustomerId
        ? await this.fetchAllCustomerPayments(master.asaasCustomerId)
        : []

      const coveredPendingIds = new Set<string>()
      const coveredPaymentIds = new Set<string>()
      for (const payment of asaasPayments) {
        if (payment.id) coveredPaymentIds.add(payment.id)
        const externalReference = payment.externalReference ?? ""
        if (externalReference.startsWith("pending-action-")) {
          coveredPendingIds.add(externalReference.slice("pending-action-".length))
        }
      }

      const asaasRows: UnifiedInvoiceRow[] = asaasPayments.map((payment) => {
        const classification = classifyAsaasPaymentInvoice({
          subscription: payment.subscription,
          externalReference: payment.externalReference,
          description: payment.description,
        })
        const status = payment.status ?? "PENDING"
        return {
          id: payment.id,
          invoiceIdDisplay: payment.invoiceNumber ? `#${payment.invoiceNumber}` : payment.id,
          invoiceName: classification.invoiceName,
          invoiceKind: classification.invoiceKind,
          source: "asaas" as const,
          status,
          statusGroup: getStatusGroup(status),
          value: normalizeAsaasValue(payment.value),
          dateCreated: payment.dateCreated ?? null,
          dueDate: payment.dueDate ?? null,
          paymentDate: payment.clientPaymentDate ?? payment.paymentDate ?? null,
          description: payment.description ?? "Descrição não informada",
          billingType: payment.billingType ?? "UNDEFINED",
          invoiceUrl: payment.invoiceUrl ?? null,
          bankSlipUrl: payment.bankSlipUrl ?? null,
          invoiceNumber: payment.invoiceNumber ?? null,
          checkoutUrl: null,
          pendingActionId: null,
          sortDate: getSortableInvoiceDate(payment),
        }
      })

      const pendingActions = await pendingActionRepository.listBillingByMasterId(masterProfileId)
      const pendingRows: UnifiedInvoiceRow[] = []

      for (const action of pendingActions) {
        const payload =
          action.payload && typeof action.payload === "object" && !Array.isArray(action.payload)
            ? (action.payload as Record<string, unknown>)
            : {}
        const charge = readPayloadCharge(payload)
        if (charge <= 0) continue
        if (coveredPendingIds.has(action.id)) continue
        if (action.paymentId && coveredPaymentIds.has(action.paymentId)) continue

        const classification = classifyPendingActionInvoice(action.actionType)
        const mappedStatus = mapPendingActionStatus({
          status: action.status,
          paymentId: action.paymentId,
          payload,
        })
        const createdIso = action.createdAt.toISOString()
        const createdDate = createdIso.slice(0, 10)
        const billingType =
          typeof payload.billingType === "string" ? payload.billingType : "UNDEFINED"

        pendingRows.push({
          id: buildPendingActionInvoiceId(action.id),
          invoiceIdDisplay: buildPendingActionInvoiceId(action.id),
          invoiceName: classification.invoiceName,
          invoiceKind: classification.invoiceKind,
          source: "pending_action",
          status: mappedStatus.status,
          statusGroup: mappedStatus.statusGroup,
          value: charge,
          dateCreated: createdDate,
          dueDate: createdDate,
          paymentDate: null,
          description: buildPendingActionDescription(action.actionType, payload),
          billingType,
          invoiceUrl: null,
          bankSlipUrl: null,
          invoiceNumber: null,
          checkoutUrl:
            action.status === "pending" ? getFullUrl(`/addon-checkout/${action.id}`) : null,
          pendingActionId: action.id,
          sortDate: action.createdAt.getTime(),
        })
      }

      const adhesions = await this.adhesionRepository.findByCreatedProfileId(masterProfileId)
      const externalRows = adhesions.flatMap((adhesion) =>
        buildExternalInvoiceRowsFromAdhesion(adhesion)
      )

      const allRows = [...asaasRows, ...pendingRows, ...externalRows]
        .filter((row) => statusFilter === "all" || row.statusGroup === statusFilter)
        .filter((row) => matchesPeriodFilter(row.dueDate ?? undefined, periodFilter, now, timezone))
        .sort((a, b) => b.sortDate - a.sortDate)

      const totalItems = allRows.length
      const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
      const safePage = Math.min(page, totalPages)
      const offset = (safePage - 1) * pageSize
      const pagedItems = allRows.slice(offset, offset + pageSize)

      const items = pagedItems.map(({ sortDate: _sortDate, ...item }) => item)

      const summary = allRows.reduce(
        (acc, item) => {
          if (item.statusGroup === "paid") {
            acc.charged += 1
          } else if (item.statusGroup === "upcoming") {
            acc.upcoming += 1
          } else if (item.statusGroup === "overdue") {
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

  async listMasterUserPendingActions(masterProfileId: string): Promise<Output> {
    try {
      const master = await this.platformUsersRepository.findMasterUserBillingById(masterProfileId)
      if (!master) {
        return new Output(false, [], ["Usuário master não encontrado"], null)
      }

      const actions = await pendingActionRepository.listBillingByMasterId(masterProfileId)

      const items = actions.map((action) => {
        const payload =
          action.payload && typeof action.payload === "object" && !Array.isArray(action.payload)
            ? (action.payload as Record<string, unknown>)
            : {}
        const charge = readPayloadCharge(payload)
        const classification = classifyPendingActionInvoice(action.actionType)
        const { name: targetName, email: targetEmail } = resolvePendingActionTarget(payload)
        const targetRole = typeof payload.role === "string" ? payload.role : null
        const payloadTeamId = typeof payload.teamId === "string" ? payload.teamId : null
        const canCancel =
          action.status === "pending" ||
          action.status === "failed" ||
          (action.status === "applied" && payload.paymentStatus === "WAIVED")

        return {
          id: action.id,
          actionType: action.actionType,
          actionTypeLabel: classification.invoiceName,
          status: action.status,
          paymentId: action.paymentId,
          teamId: action.teamId ?? payloadTeamId,
          value: charge,
          createdAt: action.createdAt.toISOString(),
          updatedAt: action.updatedAt.toISOString(),
          description: buildPendingActionDescription(action.actionType, payload),
          target: {
            name: targetName,
            email: targetEmail,
            role: targetRole,
            teamId: action.teamId ?? payloadTeamId,
          },
          checkoutUrl:
            action.status === "pending" ? getFullUrl(`/addon-checkout/${action.id}`) : null,
          invoiceId: buildPendingActionInvoiceId(action.id),
          canCancel,
        }
      })

      return new Output(true, [], [], {
        items,
        totalItems: items.length,
      })
    } catch (error) {
      console.error("[BackofficePlatformUsersUseCase][listMasterUserPendingActions]", error)
      return new Output(false, [], ["Erro ao carregar ações pendentes do cliente"], null)
    }
  }

  async cancelMasterUserPendingAction(
    masterProfileId: string,
    pendingActionId: string,
    actor: {
      profileId: string
      backofficeUserId: string | null
      backofficeEmail: string
    }
  ): Promise<Output> {
    if (!pendingActionId || pendingActionId.trim().length === 0) {
      return new Output(false, [], ["ID da ação pendente é obrigatório"], null)
    }

    console.info(
      "[BackofficePlatformUsersUseCase][cancelMasterUserPendingAction] Solicitação de cancelamento",
      {
        masterProfileId,
        pendingActionId,
        actorProfileId: actor.profileId,
        actorBackofficeUserId: actor.backofficeUserId,
        actorEmail: actor.backofficeEmail,
      }
    )

    return this.deleteMasterUserInvoice(
      masterProfileId,
      buildPendingActionInvoiceId(pendingActionId),
      actor
    )
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

      const pendingActionId = parsePendingActionInvoiceId(invoiceId)
      if (pendingActionId) {
        const action = await pendingActionRepository.findByIdSimple(pendingActionId)
        if (!action || action.masterId !== masterProfileId) {
          return new Output(false, [], ["Fatura não encontrada"], null)
        }

        const payload =
          action.payload && typeof action.payload === "object" && !Array.isArray(action.payload)
            ? (action.payload as Record<string, unknown>)
            : {}
        const charge = readPayloadCharge(payload)
        const classification = classifyPendingActionInvoice(action.actionType)
        const mappedStatus = mapPendingActionStatus({
          status: action.status,
          paymentId: action.paymentId,
          payload,
        })
        const createdDate = action.createdAt.toISOString().slice(0, 10)
        const billingType =
          typeof payload.billingType === "string" ? payload.billingType : "UNDEFINED"

        return new Output(true, [], [], {
          id: buildPendingActionInvoiceId(action.id),
          invoiceIdDisplay: buildPendingActionInvoiceId(action.id),
          invoiceName: classification.invoiceName,
          invoiceKind: classification.invoiceKind,
          source: "pending_action",
          customerName: master.fullName ?? master.email,
          status: mappedStatus.status,
          statusGroup: mappedStatus.statusGroup,
          value: charge,
          netValue: charge,
          originalValue: charge,
          interestValue: 0,
          billingType,
          description: buildPendingActionDescription(action.actionType, payload),
          dateCreated: createdDate,
          dueDate: createdDate,
          paymentDate: null,
          confirmedDate: null,
          invoiceNumber: null,
          installmentNumber: null,
          externalReference: buildPendingActionInvoiceId(action.id),
          invoiceUrl: null,
          bankSlipUrl: null,
          transactionReceiptUrl: null,
          deleted: false,
          checkoutUrl:
            action.status === "pending" ? getFullUrl(`/addon-checkout/${action.id}`) : null,
          pendingActionId: action.id,
        })
      }

      const externalInvoiceRef = parseAdhesionExternalInvoiceId(invoiceId)
      if (externalInvoiceRef) {
        const adhesions = await this.adhesionRepository.findByCreatedProfileId(masterProfileId)
        const adhesion = adhesions.find((item) => item.id === externalInvoiceRef.adhesionId)
        if (!adhesion) {
          return new Output(false, [], ["Fatura não encontrada"], null)
        }

        const ledgerEntry = readInstallmentLedger(adhesion.installmentLedger).find(
          (entry) => entry.index === externalInvoiceRef.index
        )
        if (
          !ledgerEntry ||
          ledgerEntry.paymentSource !== "EXTERNAL" ||
          ledgerEntry.status !== "paid"
        ) {
          return new Output(false, [], ["Fatura não encontrada"], null)
        }

        const externalRow = buildExternalInvoiceRowsFromAdhesion(adhesion).find(
          (row) => row.id === invoiceId
        )
        if (!externalRow) {
          return new Output(false, [], ["Fatura não encontrada"], null)
        }

        return new Output(true, [], [], {
          id: externalRow.id,
          invoiceIdDisplay: externalRow.invoiceIdDisplay,
          invoiceName: externalRow.invoiceName,
          invoiceKind: externalRow.invoiceKind,
          source: "adhesion_external",
          customerName: master.fullName ?? master.email,
          status: externalRow.status,
          statusGroup: externalRow.statusGroup,
          value: externalRow.value,
          netValue: externalRow.value,
          originalValue: externalRow.value,
          interestValue: 0,
          billingType: externalRow.billingType,
          description: externalRow.description,
          dateCreated: externalRow.dateCreated,
          dueDate: externalRow.dueDate,
          paymentDate: externalRow.paymentDate,
          confirmedDate: externalRow.paymentDate,
          invoiceNumber: null,
          installmentNumber: externalInvoiceRef.index + 1,
          externalReference: externalRow.id,
          invoiceUrl: null,
          bankSlipUrl: null,
          transactionReceiptUrl: null,
          deleted: false,
          checkoutUrl: null,
          pendingActionId: null,
        })
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

      const classification = classifyAsaasPaymentInvoice({
        subscription: payment.subscription,
        externalReference: payment.externalReference,
        description: payment.description,
      })

      return new Output(true, [], [], {
        id: payment.id,
        invoiceIdDisplay: payment.invoiceNumber ? `#${payment.invoiceNumber}` : payment.id,
        invoiceName: classification.invoiceName,
        invoiceKind: classification.invoiceKind,
        source: "asaas",
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
        checkoutUrl: null,
        pendingActionId: null,
      })
    } catch (error) {
      console.error("[BackofficePlatformUsersUseCase][getMasterUserInvoiceById]", error)
      return new Output(false, [], ["Erro ao carregar detalhes da fatura"], null)
    }
  }

  async updateMasterUserInvoice(
    masterProfileId: string,
    invoiceId: string,
    data: { value: number; dueDate: string }
  ): Promise<Output> {
    try {
      if (!invoiceId || invoiceId.trim().length === 0) {
        return new Output(false, [], ["ID da fatura é obrigatório"], null)
      }

      if (!Number.isFinite(data.value) || data.value <= 0) {
        return new Output(false, [], ["Informe um valor válido maior que zero"], null)
      }

      if (!/^\d{4}-\d{2}-\d{2}$/.test(data.dueDate)) {
        return new Output(false, [], ["Data de vencimento inválida"], null)
      }

      const dueDateParsed = new Date(`${data.dueDate}T00:00:00.000Z`)
      if (Number.isNaN(dueDateParsed.getTime())) {
        return new Output(false, [], ["Data de vencimento inválida"], null)
      }

      const master = await this.platformUsersRepository.findMasterUserBillingById(masterProfileId)
      if (!master) {
        return new Output(false, [], ["Usuário master não encontrado"], null)
      }

      if (!master.asaasCustomerId) {
        return new Output(false, [], ["Usuário não possui cliente Asaas vinculado"], null)
      }

      const currentPayment = (await asaasFetch(`${asaasApi.payments}/${invoiceId}`, {
        method: "GET",
      })) as AsaasPaymentItem

      if (!currentPayment?.id) {
        return new Output(false, [], ["Fatura não encontrada"], null)
      }

      if (currentPayment.customer && currentPayment.customer !== master.asaasCustomerId) {
        return new Output(false, [], ["Fatura não pertence ao cliente selecionado"], null)
      }

      if (currentPayment.deleted) {
        return new Output(false, [], ["Não é possível editar uma cobrança removida"], null)
      }

      const statusGroup = getStatusGroup(currentPayment.status)
      if (statusGroup !== "upcoming" && statusGroup !== "overdue") {
        return new Output(
          false,
          [],
          ["Só é possível editar faturas a vencer ou vencidas"],
          null
        )
      }

      const payment = (await asaasFetch(`${asaasApi.payments}/${invoiceId}`, {
        method: "PUT",
        body: JSON.stringify({
          value: data.value,
          dueDate: data.dueDate,
        }),
      })) as AsaasPaymentItem

      if (!payment?.id) {
        return new Output(false, [], ["Não foi possível atualizar a cobrança no Asaas"], null)
      }

      return new Output(true, ["Cobrança atualizada com sucesso"], [], {
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
      console.error("[BackofficePlatformUsersUseCase][updateMasterUserInvoice]", error)
      return new Output(false, [], ["Erro ao atualizar a cobrança"], null)
    }
  }

  async deleteMasterUserInvoice(
    masterProfileId: string,
    invoiceId: string,
    actor: {
      profileId: string
      backofficeUserId: string | null
      backofficeEmail: string
    }
  ): Promise<Output> {
    const actorLog = {
      actorProfileId: actor.profileId,
      actorBackofficeUserId: actor.backofficeUserId,
      actorEmail: actor.backofficeEmail,
    }

    try {
      if (!invoiceId || invoiceId.trim().length === 0) {
        return new Output(false, [], ["ID da fatura é obrigatório"], null)
      }

      const master = await this.platformUsersRepository.findMasterUserBillingById(masterProfileId)
      if (!master) {
        return new Output(false, [], ["Usuário master não encontrado"], null)
      }

      const pendingActionId = parsePendingActionInvoiceId(invoiceId)
      if (pendingActionId) {
        const action = await pendingActionRepository.findByIdSimple(pendingActionId)
        if (!action || action.masterId !== masterProfileId) {
          return new Output(false, [], ["Fatura não encontrada"], null)
        }

        if (action.status === "canceled") {
          console.info(
            "[BackofficePlatformUsersUseCase][deleteMasterUserInvoice] Cobrança já estava removida",
            {
              ...actorLog,
              masterProfileId,
              masterEmail: master.email,
              invoiceId,
              source: "pending_action",
              pendingActionId: action.id,
              actionType: action.actionType,
              alreadyDeleted: true,
            }
          )
          return new Output(true, ["Cobrança já estava removida"], [], {
            id: buildPendingActionInvoiceId(action.id),
            deleted: true,
            pendingActionId: action.id,
          })
        }

        const gate = canSoftCancelPendingAction(action)
        if (!gate.ok) {
          return new Output(false, [], [gate.error], null)
        }

        const asaasPaymentId = action.paymentId
        if (action.paymentId) {
          const cancelResult = await cancelOpenAsaasPayment(action.paymentId)
          if (!cancelResult.ok) {
            return new Output(false, [], [cancelResult.error], null)
          }
        }

        const softCancel = await softCancelPendingAction(action)
        if (!softCancel.ok) {
          return new Output(false, [], [softCancel.error], null)
        }

        console.info(
          "[BackofficePlatformUsersUseCase][deleteMasterUserInvoice] Fatura removida",
          {
            ...actorLog,
            masterProfileId,
            masterEmail: master.email,
            invoiceId,
            source: "pending_action",
            pendingActionId: action.id,
            actionType: action.actionType,
            asaasPaymentId,
            previousStatus: action.status,
          }
        )

        return new Output(
          true,
          ["Cobrança removida e ação pendente cancelada com sucesso"],
          [],
          {
            id: buildPendingActionInvoiceId(action.id),
            deleted: true,
            pendingActionId: action.id,
          }
        )
      }

      if (parseAdhesionExternalInvoiceId(invoiceId)) {
        return new Output(
          false,
          [],
          ["Não é possível remover faturas de adesão pagas externamente"],
          null
        )
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

      const linkedPendingAction = await resolvePendingActionLinkedToAsaasPayment(
        masterProfileId,
        payment
      )

      if (linkedPendingAction) {
        const gate = canSoftCancelPendingAction(linkedPendingAction)
        if (!gate.ok) {
          return new Output(false, [], [gate.error], null)
        }
      }

      if (payment.deleted) {
        let pendingActionCanceled = false
        if (linkedPendingAction && linkedPendingAction.status !== "canceled") {
          const softCancel = await softCancelPendingAction(linkedPendingAction)
          if (!softCancel.ok) {
            return new Output(false, [], [softCancel.error], null)
          }
          pendingActionCanceled = !softCancel.alreadyCanceled
        } else if (linkedPendingAction?.status === "canceled" && linkedPendingAction.paymentId) {
          await pendingActionRepository.clearPaymentId(linkedPendingAction.id)
        }

        console.info(
          "[BackofficePlatformUsersUseCase][deleteMasterUserInvoice] Cobrança já estava removida",
          {
            ...actorLog,
            masterProfileId,
            masterEmail: master.email,
            invoiceId,
            source: "asaas",
            asaasPaymentId: payment.id,
            alreadyDeleted: true,
            pendingActionId: linkedPendingAction?.id ?? null,
            actionType: linkedPendingAction?.actionType ?? null,
            pendingActionCanceled,
          }
        )
        return new Output(
          true,
          [
            pendingActionCanceled
              ? "Cobrança já estava removida; ação pendente cancelada"
              : "Cobrança já estava removida",
          ],
          [],
          {
            id: payment.id,
            deleted: true,
            pendingActionId: linkedPendingAction?.id ?? null,
          }
        )
      }

      const previousStatus = payment.status ?? null
      const cancelResult = await cancelOpenAsaasPayment(payment.id)
      if (!cancelResult.ok) {
        return new Output(false, [], [cancelResult.error], null)
      }

      let pendingActionCanceled = false
      if (linkedPendingAction) {
        const softCancel = await softCancelPendingAction(linkedPendingAction)
        if (!softCancel.ok) {
          return new Output(false, [], [softCancel.error], null)
        }
        pendingActionCanceled = !softCancel.alreadyCanceled
      }

      console.info(
        "[BackofficePlatformUsersUseCase][deleteMasterUserInvoice] Fatura removida",
        {
          ...actorLog,
          masterProfileId,
          masterEmail: master.email,
          invoiceId,
          source: "asaas",
          asaasPaymentId: payment.id,
          previousStatus,
          value: payment.value ?? null,
          pendingActionId: linkedPendingAction?.id ?? null,
          actionType: linkedPendingAction?.actionType ?? null,
          pendingActionCanceled,
          externalReference: payment.externalReference ?? null,
        }
      )

      return new Output(
        true,
        [
          pendingActionCanceled
            ? "Cobrança removida e ação pendente cancelada com sucesso"
            : "Cobrança removida com sucesso",
        ],
        [],
        {
          id: payment.id,
          deleted: true,
          pendingActionId: linkedPendingAction?.id ?? null,
        }
      )
    } catch (error) {
      console.error("[BackofficePlatformUsersUseCase][deleteMasterUserInvoice]", {
        ...actorLog,
        masterProfileId,
        invoiceId,
        error,
      })
      return new Output(false, [], ["Erro ao remover a cobrança"], null)
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
          <body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
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

      const { sendTrackedEmailToProfileRecipients } = await import("@/lib/email/send-tracked-profile-email")
      const emailResult = await sendTrackedEmailToProfileRecipients({
        profileId: master.id,
        category: "invoice_notification",
        subject,
        html,
        sourceType: "backoffice_invoice",
        sourceId: payment.id,
        idempotencyKey: `invoice-notification/${payment.id}`,
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
      hasUnlimitedUsers?: boolean
      multiskillEnabled?: boolean
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

      const shouldSyncUnlimited =
        data.hasUnlimitedUsers !== undefined || data.hasPermanentSubscription !== undefined
      const previous = shouldSyncUnlimited
        ? await this.platformUsersRepository.findMasterUserDetailsById(masterProfileId, {
            page: 1,
            pageSize: 5,
          })
        : null

      const updated = await this.platformUsersRepository.updateMasterUserProfile(masterProfileId, data)
      if (!updated) {
        return new Output(false, [], ["Usuário master não encontrado ou não foi possível atualizar"], null)
      }

      const nextPermanent =
        data.hasPermanentSubscription !== undefined
          ? data.hasPermanentSubscription
          : previous?.hasPermanentSubscription === true
      const nextUnlimited = shouldSyncUnlimited
        ? updated.hasUnlimitedUsers || nextPermanent
        : undefined
      const previousUnlimited =
        previous !== null
          ? previous.hasUnlimitedUsers || previous.hasPermanentSubscription
          : null

      if (
        previousUnlimited !== null &&
        nextUnlimited !== undefined &&
        previousUnlimited !== nextUnlimited
      ) {
        await memberProBillingUseCase.syncBillingAfterUsageChange(
          masterProfileId,
          "has_unlimited_users_toggle"
        )
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
      generateCharge?: boolean
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
        if (!existingProfile.supabaseId) {
          return new Output(false, [], ["Usuário precisa ter conta ativa no sistema"], null)
        }

        const alreadyInTeam = await this.platformUsersRepository.findTeamMember(
          data.teamId,
          existingProfile.id
        )
        if (alreadyInTeam) {
          return new Output(false, [], ["Usuário já pertence a este time"], null)
        }

        const belongsToMaster = await this.platformUsersRepository.profileBelongsToMasterAccount(
          existingProfile.id,
          masterProfileId
        )

        const existingDisplayName = existingProfile.fullName ?? trimmedName

        if (!belongsToMaster) {
          const billingOwner = master as BillingOwnerProfile
          const bypassCharge = await memberProBillingUseCase.shouldBypassIncrementalCharge(
            masterProfileId,
            { forceCharge: data.generateCharge }
          )

          if (!bypassCharge) {
            const projectedBilling = await incrementalBillingService.projectBilling(masterProfileId, {
              additionalUsers: 1,
            })

            if (!billingOwner.hasPermanentSubscription && projectedBilling.billingDelta > 0) {
              const chargeError = backofficeIncrementalBillingCoordinator.assertChargeableMaster(billingOwner)
              if (chargeError) {
                return new Output(false, [], [chargeError], null)
              }

              const pending = await backofficeIncrementalBillingCoordinator.createAddMemberPendingAction({
                master: billingOwner,
                teamId: data.teamId,
                profileId: existingProfile.id,
                profileEmail: existingProfile.email,
                profileName: existingDisplayName,
                role: data.role,
                functions: data.functions,
                ...delegatedPermissions,
                initiatedBy: "backoffice",
              })

              return new Output(
                true,
                ["Cobrança pendente criada. O usuário será adicionado após o pagamento."],
                [],
                {
                  requiresPayment: true,
                  pendingActionId: pending.pendingActionId,
                  checkoutUrl: pending.checkoutUrl,
                  totalCharge: pending.totalCharge,
                  remainingMonths: pending.remainingMonths,
                }
              )
            }

            await this.platformUsersRepository.assertUserSubscriptionCapacity(masterProfileId)
          }
        }

        await this.platformUsersRepository.addExistingProfileToTeam(
          existingProfile.id,
          data.teamId,
          data.role,
          data.functions,
          delegatedPermissions
        )

        await emailService.sendEmailUntracked({
          to: [email],
          subject: "Corretor Studio - Você foi adicionado a um novo time",
          html: buildAddedToTeamEmail({ userName: existingDisplayName, loginUrl: `${appUrl}/sign-in` }),
        }).catch((err: unknown) => {
          console.error("[BackofficePlatformUsersUseCase][addMemberToMasterUser] Erro ao enviar e-mail ao usuário existente:", err)
        })

        await emailService.sendEmailUntracked({
          to: [master.email],
          subject: "Corretor Studio - Novo usuário adicionado",
          html: buildMasterNotificationEmail({ masterName: master.fullName ?? master.email, userName: existingDisplayName, userEmail: email, roleLabel }),
        }).catch((err: unknown) => {
          console.error("[BackofficePlatformUsersUseCase][addMemberToMasterUser] Erro ao enviar e-mail ao master:", err)
        })

        console.info("[BackofficePlatformUsersUseCase][addMemberToMasterUser] Usuário existente adicionado ao time:", email)
        await memberProBillingUseCase.syncBillingAfterUsageChange(masterProfileId, "add_member")
        return new Output(true, ["Usuário adicionado ao time com sucesso"], [], { profileId: existingProfile.id })
      }

      const billingOwner = master as BillingOwnerProfile
      const generateCharge = data.generateCharge === true
      const bypassCharge = await memberProBillingUseCase.shouldBypassIncrementalCharge(
        masterProfileId,
        { forceCharge: generateCharge }
      )

      if (!bypassCharge && generateCharge && !billingOwner.hasPermanentSubscription) {
        const chargeError = backofficeIncrementalBillingCoordinator.assertChargeableMaster(billingOwner)
        if (chargeError) {
          return new Output(false, [], [chargeError], null)
        }

        const projectedBilling = await incrementalBillingService.projectBilling(masterProfileId, {
          additionalUsers: 1,
        })

        if (projectedBilling.billingDelta > 0) {
          const pending = await backofficeIncrementalBillingCoordinator.createAddUserPendingAction({
            master: billingOwner,
            teamId: data.teamId,
            fullName: trimmedName,
            email,
            role: data.role,
            functions: data.functions,
            canCreateAccountUsers: delegatedPermissions.canCreateAccountUsers,
            canManageAccountTeams: delegatedPermissions.canManageAccountTeams,
            canTransferAccountLeads: delegatedPermissions.canTransferAccountLeads,
          })

          return new Output(
            true,
            ["Cobrança pendente criada. O usuário será adicionado após o pagamento."],
            [],
            {
              requiresPayment: true,
              pendingActionId: pending.pendingActionId,
              checkoutUrl: pending.checkoutUrl,
              totalCharge: pending.totalCharge,
              remainingMonths: pending.remainingMonths,
            }
          )
        }

        await this.platformUsersRepository.assertUserSubscriptionCapacity(masterProfileId)
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

      await emailService.sendEmailUntracked({
        to: [master.email],
        subject: "Corretor Studio - Novo usuário adicionado",
        html: buildMasterNotificationEmail({ masterName: master.fullName ?? master.email, userName: trimmedName, userEmail: email, roleLabel }),
      }).catch((err: unknown) => {
        console.error("[BackofficePlatformUsersUseCase][addMemberToMasterUser] Erro ao enviar e-mail ao master:", err)
      })

      console.info("[BackofficePlatformUsersUseCase][addMemberToMasterUser] Membro adicionado:", email)
      await memberProBillingUseCase.syncBillingAfterUsageChange(masterProfileId, "add_user")
      return new Output(true, ["Usuário convidado com sucesso"], [], { profileId })
    } catch (error) {
      console.error("[BackofficePlatformUsersUseCase][addMemberToMasterUser]", error)
      return new Output(false, [], ["Erro ao adicionar usuário"], null)
    }
  }

  async addMasterUserToTeam(masterProfileId: string, teamId: string): Promise<Output> {
    try {
      const master = await this.platformUsersRepository.findMasterUserBillingById(masterProfileId)
      if (!master) {
        return new Output(false, [], ["Usuário master não encontrado"], null)
      }

      const team = await this.platformUsersRepository.findTeamByIdAndMasterId(teamId, masterProfileId)
      if (!team) {
        return new Output(false, [], ["Time não encontrado ou não pertence ao master selecionado"], null)
      }

      const existingMember = await this.platformUsersRepository.findTeamMember(teamId, masterProfileId)
      if (existingMember) {
        return new Output(false, [], ["Master já pertence a este time"], null)
      }

      await this.platformUsersRepository.addExistingProfileToTeam(
        masterProfileId,
        teamId,
        "manager",
        [],
        {
          canCreateAccountUsers: false,
          canManageAccountTeams: false,
          canTransferAccountLeads: false,
        }
      )

      const emailService = createEmailService()
      const appUrl = getAppUrl({ removeTrailingSlash: true })
      const masterName = master.fullName ?? master.email

      await emailService.sendEmailUntracked({
        to: [master.email],
        subject: "Corretor Studio - Você foi adicionado a um novo time",
        html: buildAddedToTeamEmail({ userName: masterName, loginUrl: `${appUrl}/sign-in` }),
      }).catch((err: unknown) => {
        console.error("[BackofficePlatformUsersUseCase][addMasterUserToTeam] Erro ao enviar e-mail:", err)
      })

      console.info("[BackofficePlatformUsersUseCase][addMasterUserToTeam] Master adicionado ao time:", teamId)
      return new Output(true, ["Master adicionado ao time com sucesso"], [], { profileId: masterProfileId, teamId })
    } catch (error) {
      console.error("[BackofficePlatformUsersUseCase][addMasterUserToTeam]", error)
      return new Output(false, [], ["Erro ao adicionar master ao time"], null)
    }
  }

  async addTeamToMasterUser(
    masterProfileId: string,
    data: { name: string; generateCharge?: boolean }
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

      const billingOwner = master as BillingOwnerProfile
      const generateCharge = data.generateCharge === true
      const bypassCharge = await memberProBillingUseCase.shouldBypassIncrementalCharge(
        masterProfileId,
        { forceCharge: generateCharge }
      )

      if (!bypassCharge && generateCharge && !billingOwner.hasPermanentSubscription) {
        const chargeError = backofficeIncrementalBillingCoordinator.assertChargeableMaster(billingOwner)
        if (chargeError) {
          return new Output(false, [], [chargeError], null)
        }

        const proportionalData = await incrementalBillingService.calculateProportionalAmount(
          masterProfileId,
          "team"
        )

        if (proportionalData.billingDelta > 0) {
          const pending = await backofficeIncrementalBillingCoordinator.createCreateTeamPendingAction({
            master: billingOwner,
            teamName: name,
            masterFunctions: (master.functions ?? []) as ("SDR" | "CLOSER")[],
          })

          return new Output(
            true,
            ["Cobrança pendente criada. O time será criado após o pagamento."],
            [],
            {
              requiresPayment: true,
              pendingActionId: pending.pendingActionId,
              checkoutUrl: pending.checkoutUrl,
              totalCharge: pending.totalCharge,
              remainingMonths: pending.remainingMonths,
            }
          )
        }
      }

      const team = await this.platformUsersRepository.createTeamForMaster(masterProfileId, name)

      console.info("[BackofficePlatformUsersUseCase][addTeamToMasterUser] Time criado:", team.id)
      await memberProBillingUseCase.syncBillingAfterUsageChange(masterProfileId, "add_team")
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
      await memberProBillingUseCase.syncBillingAfterUsageChange(masterProfileId, "remove_team")
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
