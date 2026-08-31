import type { BackofficeAdhesionBillingCycle, BackofficeProduct, BackofficeProductPaymentRule } from "@prisma/client"
import { productHasFeatureSlug } from "@/lib/backoffice-products/product-feature-slugs"
import { asaasApi, asaasFetch, createAsaasClient, type AsaasAccountId } from "@/lib/asaas"
import { asaasCustomerGateway } from "@/app/api/infra/gateways/asaasCustomer/AsaasCustomerGateway"
import {
  BACKOFFICE_ADHESION_CYCLE_LABELS,
  BACKOFFICE_ADHESION_CYCLE_MONTHS,
  type BackofficeAdhesionPrices,
  calculateBackofficeAdhesionPricing,
  resolveCardMonthlyPriceFromRule,
  resolveProductPriceForCycle,
  scaleInstallmentScheduleToTotal,
} from "@/lib/backoffice-adhesions/adhesion-pricing"
import {
  generateBackofficeAdhesionToken,
  getBackofficeAdhesionTokenPreview,
  hashBackofficeAdhesionToken,
  validateBackofficeAdhesionToken,
} from "@/lib/backoffice-adhesions/adhesion-token-validation"
import {
  hasExternalActivation,
  isAdhesionAccountActivated,
  readInstallmentLedger,
  type AdhesionInstallmentLedgerEntry,
} from "@/lib/backoffice-adhesions/installment-ledger"
import { resolveAdhesionInstallmentDueDate } from "@/lib/backoffice-adhesions/installment-due-date"
import { addMonthsInTz, DEFAULT_TZ, formatIntimezone } from "@/lib/dates"
import { createEmailService } from "@/lib/email/create-email-service"
import { buildSetPasswordEmailAuthLink } from "@/lib/supabase/email-auth-link"
import { createSupabaseAdmin } from "@/lib/supabase/server"
import { getFullUrl } from "@/lib/utils/app-url"
import { isE2eTestMode } from "@/lib/e2e/is-e2e-test-mode"
import type {
  BackofficeAdhesionWithRelations,
  IBackofficeAdhesionRepository,
} from "@/app/api/infra/data/repositories/backoffice/backofficeAdhesion/IBackofficeAdhesionRepository"
import { BackofficeAdhesionRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeAdhesion/BackofficeAdhesionRepository"
import type { IBackofficeProductRepository, BackofficeProductWithPaymentRules } from "@/app/api/infra/data/repositories/backoffice/backofficeProduct/IBackofficeProductRepository"
import { BackofficeProductRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeProduct/BackofficeProductRepository"
import type { IBackofficeUserSubscriptionRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeUserSubscription/IBackofficeUserSubscriptionRepository"
import { BackofficeUserSubscriptionRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeUserSubscription/BackofficeUserSubscriptionRepository"
import type { IBackofficeAllUsersRepository } from "@/app/api/infra/data/repositories/backoffice/AllUsersRepository/IBackofficeAllUsersRepository"
import { BackofficeAllUsersRepository } from "@/app/api/infra/data/repositories/backoffice/AllUsersRepository/BackofficeAllUsersRepository"
import type { IBackofficeSponsorAuthorizationRepository } from "@/app/api/infra/data/repositories/backofficeSponsorAuthorization/IBackofficeSponsorAuthorizationRepository"
import { BackofficeSponsorAuthorizationRepository } from "@/app/api/infra/data/repositories/backofficeSponsorAuthorization/BackofficeSponsorAuthorizationRepository"
import type { IBackofficeUserRepository } from "@/app/api/infra/data/repositories/backoffice/UserRepository/IBackofficeUserRepository"
import { BackofficeUserRepository } from "@/app/api/infra/data/repositories/backoffice/UserRepository/BackofficeUserRepository"
import type {
  BackofficeAdhesionCheckoutInput,
  BackofficeAdhesionCreateInput,
  BackofficeAdhesionCreationResult,
  BackofficeAdhesionDTO,
  BackofficeAdhesionListDTO,
  BackofficeAdhesionOptionsDTO,
  BackofficeAdhesionPaymentDTO,
  BackofficeAdhesionPaymentWebhookInput,
  BackofficeAdhesionPublicDTO,
  BackofficeAdhesionTokenError,
  BackofficeAdhesionUpdateInput,
  IBackofficeAdhesionService,
} from "./IBackofficeAdhesionService"

function isE2eOrCiBypass(): boolean {
  return isE2eTestMode() || process.env.CI === "true" || process.env.APP_ENV === "test"
}

const CRM_MODULES = ["crm"]
const CRM_PRODUCT_SLUG = "crm"
const EXTRA_TEAM_PRODUCT_SLUG = "extra-team"
const EXTRA_USER_PRODUCT_SLUG = "extra-user"
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000
const PAID_ASAAS_STATUSES = new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH", "APPROVED"])
const OVERDUE_ASAAS_STATUSES = new Set(["OVERDUE"])
const CANCELED_ASAAS_STATUSES = new Set([
  "REFUNDED",
  "CANCELED",
  "CANCELLED",
  "CHARGEBACK",
  "REFUSED",
])

const ADHESION_UUID =
  "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
const ADHESION_INSTALLMENT_REF_RE = new RegExp(
  `^backoffice-adhesion-(${ADHESION_UUID})-installment-(\\d+)$`,
  "i"
)
const ADHESION_LEGACY_REF_RE = new RegExp(`^backoffice-adhesion-(${ADHESION_UUID})$`, "i")

function parseAdhesionExternalReference(
  externalReference: string | null | undefined
): { adhesionId: string; installmentIndex: number | null } | null {
  if (!externalReference) return null
  const installmentMatch = ADHESION_INSTALLMENT_REF_RE.exec(externalReference)
  if (installmentMatch) {
    return {
      adhesionId: installmentMatch[1],
      installmentIndex: Number(installmentMatch[2]),
    }
  }
  const legacyMatch = ADHESION_LEGACY_REF_RE.exec(externalReference)
  if (legacyMatch) {
    return { adhesionId: legacyMatch[1], installmentIndex: null }
  }
  return null
}

function usesCustomInstallmentCheckout(
  adhesion: BackofficeAdhesionWithRelations,
  paymentRules: BackofficeProductPaymentRule[],
  billingType: string
): boolean {
  if (billingType !== "CREDIT_CARD") return false
  const cardRule = paymentRules.find(
    (rule) => rule.billingCycle === adhesion.cycle && rule.paymentMethod === "CREDIT_CARD"
  )
  if (cardRule?.installmentSplitMode === "CUSTOM") return true
  return false
}

function roundCurrency(value: number): number {
  return Number(value.toFixed(2))
}

function decimalToNumber(value: { toString(): string } | number): number {
  if (typeof value === "number") return value
  return Number(value.toString())
}

function normalizeText(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function normalizeDigits(value: string | null | undefined, maxLength: number): string {
  return (value ?? "").replace(/\D/g, "").slice(0, maxLength)
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function addTokenTtl(now = new Date()): Date {
  return new Date(now.getTime() + TOKEN_TTL_MS)
}

function getPublicUrl(token: string): string {
  return getFullUrl(`/adesao/${token}`)
}

function expireTokenNow(): Date {
  return new Date()
}

function mapAdhesion(adhesion: BackofficeAdhesionWithRelations): BackofficeAdhesionDTO {
  return {
    id: adhesion.id,
    leadId: adhesion.leadId,
    leadName: adhesion.lead.name,
    fullName: adhesion.fullName,
    phone: adhesion.phone,
    cpfCnpj: adhesion.cpfCnpj ?? adhesion.lead.cpfCnpj,
    email: adhesion.email ?? adhesion.lead.email,
    sdrBackofficeUserId: adhesion.sdrBackofficeUserId,
    closerBackofficeUserId: adhesion.closerBackofficeUserId,
    status: adhesion.status,
    cycle: adhesion.cycle,
    modules: adhesion.modules,
    extraTeams: adhesion.extraTeams,
    extraUsers: adhesion.extraUsers,
    monthlyBaseAmount: decimalToNumber(adhesion.monthlyBaseAmount),
    monthlyExtraTeamsAmount: decimalToNumber(adhesion.monthlyExtraTeamsAmount),
    monthlyExtraUsersAmount: decimalToNumber(adhesion.monthlyExtraUsersAmount),
    monthlyTotalAmount: decimalToNumber(adhesion.monthlyTotalAmount),
    totalAmount: decimalToNumber(adhesion.totalAmount),
    expiresAt: adhesion.expiresAt.toISOString(),
    createdAt: adhesion.createdAt.toISOString(),
    paidAt: adhesion.paidAt?.toISOString() ?? null,
    billingType: adhesion.billingType,
    asaasPaymentId: adhesion.asaasPaymentId,
    productId: adhesion.productId,
    hasUnlimitedUsers: adhesion.hasUnlimitedUsers === true,
    multiskillEnabled: adhesion.multiskillEnabled === true,
    accountProvisioned: Boolean(adhesion.createdProfileId),
    hasExternalActivation: hasExternalActivation(adhesion.installmentLedger),
  }
}

function sumPendingLedgerAmount(ledger: AdhesionInstallmentLedgerEntry[]): number {
  return roundCurrency(
    ledger.filter((entry) => entry.status === "pending").reduce((sum, entry) => sum + entry.amount, 0)
  )
}

function resolveCheckoutChargeAmount(
  publicDetails: BackofficeAdhesionPublicDTO,
  billingType: "PIX" | "CREDIT_CARD"
): number {
  const ledgerHasPending =
    publicDetails.installmentSchedule.length > 0 && publicDetails.remainingBalance > 0

  if (ledgerHasPending) {
    return publicDetails.remainingBalance
  }

  return billingType === "PIX"
    ? publicDetails.pixTotalAmount
    : publicDetails.creditCardTotalAmount
}

function mapPublicAdhesion(
  adhesion: BackofficeAdhesionWithRelations,
  paymentRules?: BackofficeProductPaymentRule[]
): BackofficeAdhesionPublicDTO {
  const cycleMonths = BACKOFFICE_ADHESION_CYCLE_MONTHS[adhesion.cycle] ?? 1
  const monthlyExtras = roundCurrency(
    decimalToNumber(adhesion.monthlyExtraTeamsAmount) +
    decimalToNumber(adhesion.monthlyExtraUsersAmount)
  )

  let pixMonthlyTotalAmount = decimalToNumber(adhesion.monthlyTotalAmount)
  let pixTotalAmount = decimalToNumber(adhesion.totalAmount)
  let creditCardMonthlyTotalAmount = decimalToNumber(adhesion.monthlyTotalAmount)
  let creditCardTotalAmount = decimalToNumber(adhesion.totalAmount)
  let maxCardInstallments = cycleMonths
  let installmentSplitMode: "EQUAL" | "CUSTOM" | null = null
  let productInstallmentSchedule: number[] = []

  if (paymentRules && paymentRules.length > 0) {
    const pixRule = paymentRules.find(
      (r) => r.billingCycle === adhesion.cycle && r.paymentMethod === "PIX"
    )
    if (pixRule) {
      pixMonthlyTotalAmount = roundCurrency(Number(pixRule.price.toString()) + monthlyExtras)
      pixTotalAmount = roundCurrency(pixMonthlyTotalAmount * cycleMonths)
    }

    const cardRule = paymentRules.find(
      (r) => r.billingCycle === adhesion.cycle && r.paymentMethod === "CREDIT_CARD"
    )
    if (cardRule) {
      creditCardMonthlyTotalAmount = roundCurrency(
        resolveCardMonthlyPriceFromRule(cardRule, adhesion.cycle) + monthlyExtras
      )
      creditCardTotalAmount = roundCurrency(creditCardMonthlyTotalAmount * cycleMonths)
      maxCardInstallments = cardRule.maxInstallments
      installmentSplitMode = (cardRule.installmentSplitMode as "EQUAL" | "CUSTOM") ?? "EQUAL"
      productInstallmentSchedule =
        installmentSplitMode === "CUSTOM" && Array.isArray(cardRule.installmentSchedule)
          ? (cardRule.installmentSchedule as number[]).map((value) => Number(value))
          : []
    }
  }

  const ledger = readInstallmentLedger(adhesion.installmentLedger)
  const remainingBalance =
    ledger.length > 0 ? sumPendingLedgerAmount(ledger) : roundCurrency(decimalToNumber(adhesion.totalAmount))
  const installmentSchedule =
    ledger.length > 0 ? ledger.map((entry) => entry.amount) : productInstallmentSchedule

  const presetBillingType = adhesion.billingType === "PIX" ? "PIX" : "CREDIT_CARD"
  const resolvedMonthlyTotalAmount =
    presetBillingType === "PIX" ? pixMonthlyTotalAmount : creditCardMonthlyTotalAmount
  const resolvedTotalAmount = presetBillingType === "PIX" ? pixTotalAmount : creditCardTotalAmount
  const resolvedMaxInstallments =
    presetBillingType === "PIX"
      ? 1
      : installmentSplitMode === "CUSTOM"
        ? Math.max(1, installmentSchedule.length)
        : Math.max(1, Math.trunc(maxCardInstallments || 1))
  const chargeAmount =
    presetBillingType === "PIX"
      ? ledger.length > 0
        ? remainingBalance
        : pixTotalAmount
      : ledger.length > 0
        ? remainingBalance
        : creditCardTotalAmount

  return {
    id: adhesion.id,
    fullName: adhesion.fullName,
    phone: adhesion.phone,
    email: adhesion.email ?? adhesion.lead.email ?? null,
    cpfCnpj: adhesion.cpfCnpj ?? adhesion.lead.cpfCnpj ?? null,
    billingType:
      adhesion.billingType === "PIX"
        ? "PIX"
        : adhesion.billingType === "CREDIT_CARD"
          ? "CREDIT_CARD"
          : null,
    status: adhesion.status,
    cycle: adhesion.cycle,
    cycleLabel: BACKOFFICE_ADHESION_CYCLE_LABELS[adhesion.cycle],
    cycleMonths,
    modules: adhesion.modules,
    extraTeams: adhesion.extraTeams ?? 0,
    extraUsers: adhesion.extraUsers ?? 0,
    monthlyBaseAmount: roundCurrency(decimalToNumber(adhesion.monthlyBaseAmount)),
    monthlyExtraTeamsAmount: roundCurrency(decimalToNumber(adhesion.monthlyExtraTeamsAmount)),
    monthlyExtraUsersAmount: roundCurrency(decimalToNumber(adhesion.monthlyExtraUsersAmount)),
    monthlyTotalAmount: resolvedMonthlyTotalAmount,
    totalAmount: resolvedTotalAmount,
    maxInstallments: resolvedMaxInstallments,
    pixMonthlyTotalAmount,
    pixTotalAmount,
    creditCardMonthlyTotalAmount,
    creditCardTotalAmount,
    maxCardInstallments,
    installmentSplitMode,
    installmentSchedule,
    remainingBalance,
    chargeAmount,
    createdAt: adhesion.createdAt.toISOString(),
    paidAt: adhesion.paidAt?.toISOString() ?? null,
    expiresAt: adhesion.expiresAt.toISOString(),
  }
}

function mapPayment(adhesion: BackofficeAdhesionWithRelations): BackofficeAdhesionPaymentDTO {
  const ledger = readInstallmentLedger(adhesion.installmentLedger)
  const pendingAmount = sumPendingLedgerAmount(ledger)
  const payment: BackofficeAdhesionPaymentDTO = {
    adhesionId: adhesion.id,
    paymentId: adhesion.asaasPaymentId,
    status: adhesion.status,
    billingType: adhesion.billingType,
    amount: ledger.length > 0 ? pendingAmount : decimalToNumber(adhesion.totalAmount),
    invoiceUrl: adhesion.invoiceUrl,
    bankSlipUrl: adhesion.bankSlipUrl,
  }

  if (adhesion.billingType === "PIX" && adhesion.pixPayload) {
    payment.pix = {
      encodedImage: adhesion.pixQrCode ?? "",
      payload: adhesion.pixPayload,
      expirationDate: adhesion.paymentDueDate?.toISOString() ?? null,
    }
  }

  if (adhesion.billingType === "BOLETO" && adhesion.bankSlipUrl) {
    payment.boleto = {
      bankSlipUrl: adhesion.bankSlipUrl,
      identificationField: "",
      barCode: "",
      dueDate: adhesion.paymentDueDate?.toISOString() ?? null,
    }
  }

  return payment
}

function tokenError(status: BackofficeAdhesionTokenError["tokenStatus"]): BackofficeAdhesionTokenError {
  return { tokenStatus: status }
}

function mapSyncedPaymentEvent(payment: BackofficeAdhesionPaymentWebhookInput): string {
  const status = payment.status?.toUpperCase() ?? ""

  if (status === "OVERDUE") {
    return "PAYMENT_OVERDUE"
  }

  if (status === "REFUSED") {
    return "PAYMENT_CREDIT_CARD_CAPTURE_REFUSED"
  }

  if (status === "CANCELED" || status === "CANCELLED" || status === "REFUNDED" || status === "CHARGEBACK") {
    return "PAYMENT_DELETED"
  }

  if (status === "APPROVED") {
    return "PAYMENT_APPROVED"
  }

  return "PAYMENT_CONFIRMED"
}

export class BackofficeAdhesionService implements IBackofficeAdhesionService {
  constructor(
    private readonly repo: IBackofficeAdhesionRepository = new BackofficeAdhesionRepository(),
    private readonly productRepo: IBackofficeProductRepository = new BackofficeProductRepository(),
    private readonly userSubscriptionRepo: IBackofficeUserSubscriptionRepository = new BackofficeUserSubscriptionRepository(),
    private readonly allUsersRepo: IBackofficeAllUsersRepository = new BackofficeAllUsersRepository(),
    private readonly sponsorAuthorizationRepo: IBackofficeSponsorAuthorizationRepository = new BackofficeSponsorAuthorizationRepository(),
    private readonly backofficeUserRepo: IBackofficeUserRepository = new BackofficeUserRepository()
  ) {}

  private async resolveAssignedByProfileId(
    createdByBackofficeUserId: string | null | undefined
  ): Promise<string | null> {
    if (!createdByBackofficeUserId) return null
    const creator = await this.backofficeUserRepo.findById(createdByBackofficeUserId)
    return creator?.profileId ?? null
  }

  async list(input: {
    page: number
    pageSize: number
    status?: BackofficeAdhesionDTO["status"]
    query?: string
  }): Promise<BackofficeAdhesionListDTO> {
    const page = Math.max(input.page || 1, 1)
    const pageSize = Math.max(input.pageSize || 10, 5)
    const result = await this.repo.list({ ...input, page, pageSize })
    const totalPages = Math.max(1, Math.ceil(result.totalItems / pageSize))

    return {
      items: result.items.map(mapAdhesion),
      pagination: {
        page,
        pageSize,
        totalItems: result.totalItems,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    }
  }

  async getOptions(): Promise<BackofficeAdhesionOptionsDTO> {
    const [options, sponsorProfiles] = await Promise.all([
      this.repo.getOptions(),
      this.sponsorAuthorizationRepo.listActiveAuthorizedProfiles(),
    ])
    const users = options.users.map((user) => ({
      id: user.id,
      name: user.profile.fullName ?? user.email,
      email: user.email || user.profile.email,
      isSdr: user.isSdr,
      isCloser: user.isCloser,
    }))

    const pricingCycles = await this.resolvePricingOptions()
    const crmVariants = await this.productRepo.findByFeatureSlugWithPaymentRules(CRM_PRODUCT_SLUG)
    const productVariants = this.mapProductVariants(crmVariants)

    return {
      leads: options.leads.map((lead) => ({
        id: lead.id,
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        cpfCnpj: lead.cpfCnpj,
        status: lead.status,
        sdrBackofficeUserId: lead.sdrBackofficeUserId,
        closerBackofficeUserId: lead.closerBackofficeUserId,
      })),
      sdrOptions: users
        .filter((user) => user.isSdr)
        .map((user) => ({ id: user.id, name: user.name, email: user.email })),
      closerOptions: users
        .filter((user) => user.isCloser)
        .map((user) => ({ id: user.id, name: user.name, email: user.email })),
      sponsorOptions: sponsorProfiles.map((s) => ({
        id: s.id,
        name: s.fullName ?? s.email ?? s.id,
        email: s.email ?? "",
      })),
      pricing: {
        cycles: pricingCycles,
      },
      productVariants,
    }
  }

  async create(
    input: BackofficeAdhesionCreateInput,
    createdByBackofficeUserId: string | null
  ): Promise<BackofficeAdhesionCreationResult> {
    const normalized = this.normalizeCommercialInput(input)
    const crmWithRules = await this.getProductForAdhesion(CRM_PRODUCT_SLUG, normalized.productId)
    const options = await this.repo.getOptions()
    const lead = options.leads.find((item) => item.id === normalized.leadId)

    if (!lead) {
      throw new Error("Lead não está elegível para nova adesão")
    }

    const existing = await this.repo.findByLeadId(normalized.leadId)
    if (existing) {
      throw new Error("Lead já possui uma adesão vinculada")
    }

    if (normalized.activationMode === "external_paid" && normalized.email) {
      const existingProfileId = await this.repo.findProfileIdByEmail(normalized.email)
      if (existingProfileId) {
        throw new Error("Já existe uma conta cadastrada com este e-mail")
      }
    }

    if (!crmWithRules?.isActive) {
      throw new Error(`Produto obrigatório indisponível: ${CRM_PRODUCT_SLUG}`)
    }

    const availableCycles = new Set(crmWithRules.paymentRules.map((rule) => rule.billingCycle))
    if (!availableCycles.has(normalized.cycle)) {
      throw new Error(
        `O ciclo ${normalized.cycle} não está disponível na precificação selecionada`
      )
    }

    const prices = await this.resolvePrices(normalized.cycle, crmWithRules.id)
    const pricing = calculateBackofficeAdhesionPricing(normalized, prices, crmWithRules.paymentRules)
    const resolvedBillingType = normalized.billingType ?? "PIX"
    const resolvedMonthlyTotalAmount =
      resolvedBillingType === "PIX" ? pricing.pixMonthlyTotalAmount : pricing.creditCardMonthlyTotalAmount
    const resolvedTotalAmount =
      resolvedBillingType === "PIX" ? pricing.pixTotalAmount : pricing.creditCardTotalAmount

    const cardRule = crmWithRules.paymentRules.find(
      (rule) => rule.billingCycle === normalized.cycle && rule.paymentMethod === "CREDIT_CARD"
    )
    const schedule = buildAdhesionInstallmentSchedule({
      cardRule,
      cycleTotal: resolvedTotalAmount,
      maxInstallments: pricing.maxCardInstallments,
    })
    const externalIndexes = new Set(
      normalized.activationMode === "external_paid" &&
        (!normalized.externalInstallmentIndexes ||
          normalized.externalInstallmentIndexes.length === 0)
        ? schedule.map((_, index) => index)
        : (normalized.externalInstallmentIndexes ?? [])
    )
    const ledger = schedule.map((amount, index) => ({
      index,
      amount,
      paymentSource: externalIndexes.has(index) ? ("EXTERNAL" as const) : ("ASAAS" as const),
      status: externalIndexes.has(index) ? ("paid" as const) : ("pending" as const),
      asaasPaymentId: null as string | null,
      paidAt: externalIndexes.has(index) ? new Date().toISOString() : null,
    }))
    const allExternal = ledger.length > 0 && ledger.every((entry) => entry.paymentSource === "EXTERNAL")
    const anyExternal = ledger.some((entry) => entry.paymentSource === "EXTERNAL")
    const pendingAsaas = ledger.filter((entry) => entry.status === "pending")

    const token = generateBackofficeAdhesionToken()
    const adhesion = await this.repo.createAndMoveLeadToAdhesion({
      leadId: normalized.leadId,
      fullName: normalized.fullName,
      phone: normalized.phone ?? "",
      billingType: allExternal ? "EXTERNAL" : resolvedBillingType,
      plan: "crm",
      productId: crmWithRules.id,
      cycle: normalized.cycle,
      modules: CRM_MODULES,
      extraTeams: normalized.extraTeams,
      extraUsers: normalized.extraUsers,
      ...pricing,
      monthlyTotalAmount: resolvedMonthlyTotalAmount,
      totalAmount: resolvedTotalAmount,
      tokenHash: hashBackofficeAdhesionToken(token),
      tokenPreview: getBackofficeAdhesionTokenPreview(token),
      tokenPlain: token,
      expiresAt: addTokenTtl(),
      sdrBackofficeUserId: normalized.sdrBackofficeUserId ?? lead.sdrBackofficeUserId,
      closerBackofficeUserId:
        normalized.closerBackofficeUserId ?? lead.closerBackofficeUserId,
      createdByBackofficeUserId,
      requestedUserTypeSlug:
        normalized.userType === "member_pro" || normalized.userType === "associate" || normalized.userType === "guest"
          ? normalized.userType
          : null,
      requestedMemberProAccessExpiresAt:
        normalized.userType === "member_pro" && normalized.accessExpiresAt
          ? new Date(normalized.accessExpiresAt)
          : null,
      sponsorMasterId: normalized.sponsorMasterId ?? null,
      multiskillEnabled: normalized.multiskillEnabled ?? false,
      hasUnlimitedUsers: normalized.hasUnlimitedUsers === true,
      additionalUsersData: normalized.additionalUsers ?? [],
      additionalTeamsData: normalized.additionalTeams ?? [],
      installmentSchedule: schedule,
      installmentLedger: ledger,
    })

    if (normalized.userType === "guest") {
      const guestEmail = normalized.email
      if (!guestEmail) {
        throw new Error("E-mail é obrigatório para conta Convidado")
      }
      const paidAt = new Date()
      try {
        const paidAdhesion = await this.repo.markExternalPaid(adhesion.id, {
          fullName: normalized.fullName,
          phone: normalized.phone ?? "",
          email: guestEmail,
          cpfCnpj: normalized.cpfCnpj ?? null,
          paidAt,
          asaasCustomerId: null,
        })
        await this.ensureAccountForPaidAdhesion(paidAdhesion)

        return {
          adhesion: mapAdhesion(paidAdhesion),
          publicUrl: null,
          expiresAt: paidAdhesion.expiresAt.toISOString(),
          activationMode: "external_paid",
        }
      } catch (guestErr) {
        await this.repo.cancelAdhesionAndRestoreLead(adhesion.id, lead.status).catch((rollbackErr) => {
          console.error("[BackofficeAdhesionService][create][rollback]", rollbackErr)
        })
        throw guestErr
      }
    }

    if (normalized.activationMode === "external_paid" || anyExternal) {
      const externalEmail = normalized.email
      if (!externalEmail) {
        throw new Error("E-mail é obrigatório para pagamento por fora")
      }
      const normalizedCpfCnpj = (normalized.cpfCnpj ?? "").replace(/\D/g, "")
      if (!normalizedCpfCnpj || !/^\d{11}$|^\d{14}$/.test(normalizedCpfCnpj)) {
        throw new Error("CPF/CNPJ inválido para pagamento por fora")
      }
      const paidAt = new Date()
      try {
        const asaasCustomerId = await this.createExternalAsaasCustomer({
          adhesionId: adhesion.id,
          fullName: normalized.fullName,
          email: externalEmail,
          cpfCnpj: normalizedCpfCnpj,
          phone: normalized.phone ?? "",
        })

        let nextLedger = ledger
        if (pendingAsaas.length > 0) {
          nextLedger = await this.chargePendingInstallments({
            adhesion,
            customerId: asaasCustomerId,
            email: externalEmail,
            billingType: resolvedBillingType === "CREDIT_CARD" ? "CREDIT_CARD" : "PIX",
            ledger,
            pending: pendingAsaas,
          })
        }

        if (allExternal || pendingAsaas.length === 0) {
          const paidAdhesion = await this.repo.markExternalPaid(adhesion.id, {
            fullName: normalized.fullName,
            phone: normalized.phone ?? "",
            email: externalEmail,
            cpfCnpj: normalizedCpfCnpj,
            paidAt,
            asaasCustomerId,
          })
          await this.persistInstallmentLedger(adhesion.id, nextLedger, {
            email: externalEmail,
            cpfCnpj: normalizedCpfCnpj,
            asaasCustomerId,
          })
          await this.ensureAccountForPaidAdhesion(paidAdhesion)
          return {
            adhesion: mapAdhesion((await this.repo.findById(adhesion.id)) ?? paidAdhesion),
            publicUrl: null,
            expiresAt: paidAdhesion.expiresAt.toISOString(),
            activationMode: "external_paid",
          }
        }

        await this.persistInstallmentLedger(adhesion.id, nextLedger, {
          email: externalEmail,
          cpfCnpj: normalizedCpfCnpj,
          asaasCustomerId,
          paidAt,
          billingType: resolvedBillingType,
        })
        const refreshed = await this.repo.findById(adhesion.id)
        if (!refreshed) throw new Error("Adesão não encontrada após cobrança parcial")
        await this.ensureAccountForPaidAdhesion({
          ...refreshed,
          paidAt: refreshed.paidAt ?? paidAt,
          email: externalEmail,
          asaasCustomerId,
        })
        return {
          adhesion: mapAdhesion((await this.repo.findById(adhesion.id)) ?? refreshed),
          publicUrl: null,
          expiresAt: refreshed.expiresAt.toISOString(),
          activationMode: "external_paid",
        }
      } catch (externalPaidErr) {
        await this.repo.cancelAdhesionAndRestoreLead(adhesion.id, lead.status).catch((rollbackErr) => {
          console.error("[BackofficeAdhesionService][create][rollback]", rollbackErr)
        })
        throw externalPaidErr
      }
    }

    const checkoutUrl = getPublicUrl(token)
    const leadEmail = (lead.email ?? normalized.email)?.trim() ?? null
    if (leadEmail) {
      const emailService = createEmailService()
      await emailService.sendBackofficeAdhesionCheckoutEmail({
        userName: lead.name ?? normalized.fullName,
        userEmail: leadEmail,
        checkoutUrl,
        expiresAt: adhesion.expiresAt,
      })
    }

    return {
      adhesion: mapAdhesion(adhesion),
      publicUrl: checkoutUrl,
      expiresAt: adhesion.expiresAt.toISOString(),
      activationMode: "checkout",
    }
  }

  async update(id: string, input: BackofficeAdhesionUpdateInput): Promise<BackofficeAdhesionDTO> {
    const existing = await this.repo.findById(id)
    if (!existing) {
      throw new Error("Adesão não encontrada")
    }
    if (existing.status === "paid") {
      throw new Error("Adesões pagas não podem ser editadas")
    }

    const currentBillingType =
      existing.billingType === "CREDIT_CARD"
        ? "CREDIT_CARD"
        : existing.billingType === "EXTERNAL"
          ? "EXTERNAL"
          : "PIX"
    const activationMode =
      input.activationMode === "external_paid" || input.billingType === "EXTERNAL"
        ? "external_paid"
        : "checkout"
    const next = this.normalizeCommercialInput({
      leadId: existing.leadId,
      fullName: input.fullName ?? existing.fullName,
      phone: input.phone ?? existing.phone,
      email: input.email !== undefined ? input.email : existing.email,
      cpfCnpj: input.cpfCnpj !== undefined ? input.cpfCnpj : existing.cpfCnpj,
      cycle: input.cycle ?? existing.cycle,
      extraTeams: input.extraTeams ?? existing.extraTeams,
      extraUsers: input.extraUsers ?? existing.extraUsers,
      billingType: input.billingType !== undefined ? input.billingType : currentBillingType,
      sdrBackofficeUserId:
        input.sdrBackofficeUserId !== undefined
          ? input.sdrBackofficeUserId
          : existing.sdrBackofficeUserId,
      closerBackofficeUserId:
        input.closerBackofficeUserId !== undefined
          ? input.closerBackofficeUserId
          : existing.closerBackofficeUserId,
      activationMode,
      hasUnlimitedUsers:
        input.hasUnlimitedUsers !== undefined
          ? input.hasUnlimitedUsers
          : existing.hasUnlimitedUsers,
    })
    const crmWithRules = await this.getProductForAdhesion(
      CRM_PRODUCT_SLUG,
      input.productId ?? existing.productId
    )
    const prices = await this.resolvePrices(next.cycle, crmWithRules.id)
    if (!crmWithRules?.isActive) {
      throw new Error(`Produto obrigatório indisponível: ${CRM_PRODUCT_SLUG}`)
    }
    const pricing = calculateBackofficeAdhesionPricing(next, prices, crmWithRules.paymentRules)
    const resolvedMonthlyTotalAmount =
      next.billingType === "PIX" ? pricing.pixMonthlyTotalAmount : pricing.creditCardMonthlyTotalAmount
    const resolvedTotalAmount =
      next.billingType === "PIX" ? pricing.pixTotalAmount : pricing.creditCardTotalAmount

    const hadExistingPayment = Boolean(
      existing.asaasPaymentId ||
      existing.invoiceUrl ||
      existing.pixPayload ||
      existing.pixQrCode ||
      existing.bankSlipUrl
    )

    const shouldResetPaymentData =
      hadExistingPayment &&
      (existing.billingType !== next.billingType ||
        decimalToNumber(existing.totalAmount) !== resolvedTotalAmount ||
        next.activationMode === "external_paid")

    if (shouldResetPaymentData && existing.asaasPaymentId) {
      try {
        await asaasFetch(`${asaasApi.payments}/${existing.asaasPaymentId}`, {
          method: "DELETE",
        })
      } catch (cancelErr) {
        console.error("[BackofficeAdhesionService][update][cancel-payment]", cancelErr)
      }
    }

    const updated = await this.repo.update(id, {
      fullName: next.fullName,
      phone: next.phone ?? undefined,
      email: next.email,
      cpfCnpj: next.cpfCnpj,
      productId: crmWithRules.id,
      cycle: next.cycle,
      modules: CRM_MODULES,
      extraTeams: next.extraTeams,
      extraUsers: next.extraUsers,
      monthlyBaseAmount: pricing.monthlyBaseAmount,
      monthlyExtraTeamsAmount: pricing.monthlyExtraTeamsAmount,
      monthlyExtraUsersAmount: pricing.monthlyExtraUsersAmount,
      monthlyTotalAmount: resolvedMonthlyTotalAmount,
      totalAmount: resolvedTotalAmount,
      billingType: next.billingType,
      sdrBackofficeUserId: next.sdrBackofficeUserId,
      closerBackofficeUserId: next.closerBackofficeUserId,
      hasUnlimitedUsers: next.hasUnlimitedUsers === true,
    })

    const persisted = shouldResetPaymentData
      ? await this.repo.updateCheckoutData(updated.id, {
          asaasPaymentId: null,
          asaasInstallmentId: null,
          installmentCount: null,
          invoiceUrl: null,
          bankSlipUrl: null,
          pixQrCode: null,
          pixPayload: null,
          paymentDueDate: null,
        })
      : updated

    if (existing.email?.trim().toLowerCase() !== (next.email ?? "").trim().toLowerCase()) {
      await this.syncAdhesionEmailArtifacts(persisted, next.email ?? "", existing.email ?? null)
    }

    if (next.activationMode === "external_paid") {
      if (!next.email) {
        throw new Error("E-mail é obrigatório para pagamento por fora")
      }
      const normalizedCpfCnpj = (next.cpfCnpj ?? "").replace(/\D/g, "")
      if (!normalizedCpfCnpj || !/^\d{11}$|^\d{14}$/.test(normalizedCpfCnpj)) {
        throw new Error("CPF/CNPJ inválido para pagamento por fora")
      }
      const existingProfileId = await this.repo.findProfileIdByEmail(next.email)
      if (existingProfileId && existing.createdProfileId !== existingProfileId) {
        throw new Error("Já existe uma conta cadastrada com este e-mail")
      }

      const paidAt = new Date()
      const asaasCustomerId = await this.createExternalAsaasCustomer({
        adhesionId: persisted.id,
        fullName: next.fullName,
        email: next.email,
        cpfCnpj: normalizedCpfCnpj,
        phone: next.phone ?? "",
      })
      const paidAdhesion = await this.repo.markExternalPaid(persisted.id, {
        fullName: next.fullName,
        phone: next.phone ?? "",
        email: next.email,
        cpfCnpj: normalizedCpfCnpj,
        paidAt,
        asaasCustomerId,
      })
      await this.ensureAccountForPaidAdhesion(paidAdhesion)
      return mapAdhesion(paidAdhesion)
    }

    return mapAdhesion(persisted)
  }

  async deletePending(id: string): Promise<void> {
    const existing = await this.repo.findById(id)
    if (!existing) {
      throw new Error("Adesão não encontrada")
    }
    if (existing.status !== "pending") {
      throw new Error("Somente adesões pendentes podem ser excluídas")
    }

    try {
      await this.repo.cancelAdhesionAndRestoreLead(existing.id, "new_opportunity")
    } catch (deleteError) {
      console.error("[BackofficeAdhesionService][deletePending]", deleteError)
      throw new Error("Não foi possível excluir a adesão pendente")
    }
  }

  async resend(id: string): Promise<BackofficeAdhesionCreationResult> {
    const existing = await this.repo.findById(id)
    if (!existing) {
      throw new Error("Adesão não encontrada")
    }
    if (isAdhesionAccountActivated(existing)) {
      throw new Error(
        "Assinatura já ativada. Use o link de fatura das parcelas pendentes para cobrança."
      )
    }
    if (existing.status === "paid") {
      throw new Error("Adesões pagas não podem ser reenviadas")
    }

    const token = generateBackofficeAdhesionToken()
    const updated = await this.repo.update(id, {
      status: "pending",
      tokenHash: hashBackofficeAdhesionToken(token),
      tokenPreview: getBackofficeAdhesionTokenPreview(token),
      tokenPlain: token,
      expiresAt: addTokenTtl(),
    })

    const checkoutUrl = getPublicUrl(token)
    const leadEmail = (updated.lead.email ?? updated.email)?.trim() ?? null
    if (leadEmail) {
      const emailService = createEmailService()
      await emailService.sendBackofficeAdhesionCheckoutEmail({
        userName: updated.lead.name ?? updated.fullName,
        userEmail: leadEmail,
        checkoutUrl,
        expiresAt: updated.expiresAt,
      })
    }

    return {
      adhesion: mapAdhesion(updated),
      publicUrl: checkoutUrl,
      expiresAt: updated.expiresAt.toISOString(),
    }
  }

  async resendInvite(id: string): Promise<{ email: string }> {
    const existing = await this.repo.findById(id)
    if (!existing) {
      throw new Error("Adesão não encontrada")
    }
    if (!isAdhesionAccountActivated(existing)) {
      throw new Error("Convite disponível apenas após ativação da conta ou pagamento externo")
    }
    if (!existing.email) {
      throw new Error("Adesão sem e-mail para reenvio de convite")
    }

    if (!existing.createdSupabaseId && !existing.createdProfileId) {
      await this.ensureAccountForPaidAdhesion(existing)
      return { email: existing.email }
    }

    await this.syncAdhesionEmailArtifactsIfNeeded(existing)

    const fresh = (await this.repo.findById(id)) ?? existing
    if (!fresh.email) {
      throw new Error("Adesão sem e-mail para reenvio de convite")
    }

    await this.sendSetPasswordEmail(fresh, "recovery")
    console.info("[BackofficeAdhesionService][resendInvite] Novo convite gerado com expiração de 24h", {
      adhesionId: id,
      email: fresh.email,
    })
    return { email: fresh.email }
  }

  async getPendingInvoiceUrls(id: string): Promise<{
    invoices: Array<{ installmentIndex: number; amount: number; invoiceUrl: string }>
  }> {
    const adhesion = await this.repo.findById(id)
    if (!adhesion) {
      throw new Error("Adesão não encontrada")
    }
    if (!isAdhesionAccountActivated(adhesion)) {
      throw new Error("Checkout de fatura disponível apenas para assinaturas já ativadas")
    }

    let ledger = readInstallmentLedger(adhesion.installmentLedger)
    let pendingAsaas = ledger.filter(
      (entry) => entry.status === "pending" && entry.paymentSource === "ASAAS"
    )

    if (pendingAsaas.length === 0) {
      throw new Error("Não há parcelas pendentes para cobrança")
    }

    const missingPayments = pendingAsaas.filter((entry) => !entry.asaasPaymentId)
    if (missingPayments.length > 0) {
      if (!adhesion.asaasCustomerId) {
        throw new Error("Cliente Asaas não configurado para esta adesão")
      }
      if (!adhesion.email) {
        throw new Error("E-mail não configurado para esta adesão")
      }

      ledger = await this.chargePendingInstallments({
        adhesion,
        customerId: adhesion.asaasCustomerId,
        email: adhesion.email,
        billingType: adhesion.billingType === "CREDIT_CARD" ? "CREDIT_CARD" : "PIX",
        ledger,
        pending: missingPayments,
      })
      await this.persistInstallmentLedger(adhesion.id, ledger, {
        email: adhesion.email,
        cpfCnpj: adhesion.cpfCnpj,
        asaasCustomerId: adhesion.asaasCustomerId,
      })
      pendingAsaas = ledger.filter(
        (entry) => entry.status === "pending" && entry.paymentSource === "ASAAS"
      )
    }

    const invoices: Array<{ installmentIndex: number; amount: number; invoiceUrl: string }> = []
    for (const entry of pendingAsaas) {
      if (!entry.asaasPaymentId) continue
      const payment = await asaasFetch(`${asaasApi.payments}/${entry.asaasPaymentId}`)
      const invoiceUrl = (payment.invoiceUrl as string | undefined)?.trim()
      if (invoiceUrl) {
        invoices.push({
          installmentIndex: entry.index,
          amount: entry.amount,
          invoiceUrl,
        })
      }
    }

    if (invoices.length === 0) {
      throw new Error("Nenhuma fatura pendente com link de pagamento disponível")
    }

    return { invoices }
  }

  async getPublicUrl(id: string): Promise<{ publicUrl: string; expiresAt: string }> {
    const existing = await this.repo.findById(id)
    if (!existing) {
      throw new Error("Adesão não encontrada")
    }
    if (isAdhesionAccountActivated(existing)) {
      throw new Error(
        "Assinatura já ativada. Use o link de fatura das parcelas pendentes para cobrança."
      )
    }

    const token = existing.tokenPlain?.trim()
    if (!token) {
      throw new Error("Link não disponível. Reenvie a adesão para gerar um novo link.")
    }

    const now = new Date()
    if (existing.expiresAt.getTime() <= now.getTime()) {
      await this.repo
        .update(id, {
          status: existing.status === "pending" ? "expired" : existing.status,
          tokenPlain: null,
        })
        .catch(() => null)
      throw new Error("Link expirado. Reenvie a adesão para gerar um novo link.")
    }

    return { publicUrl: getPublicUrl(token), expiresAt: existing.expiresAt.toISOString() }
  }

  async getPublicDetails(
    token: string
  ): Promise<BackofficeAdhesionPublicDTO | BackofficeAdhesionTokenError> {
    const validation = await validateBackofficeAdhesionToken(token)
    if (validation.status !== "valid") {
      return tokenError(validation.status)
    }
    if (!validation.adhesionId) {
      return tokenError("not_found")
    }

    const adhesion = await this.repo.findById(validation.adhesionId)
    if (!adhesion) {
      return tokenError("not_found")
    }

    const crmProduct = await this.getProductForAdhesion(
      CRM_PRODUCT_SLUG,
      adhesion.productId
    )
    const paymentRules = crmProduct?.paymentRules ?? []

    return mapPublicAdhesion(adhesion, paymentRules)
  }

  async createCheckout(
    token: string,
    input: BackofficeAdhesionCheckoutInput
  ): Promise<BackofficeAdhesionPaymentDTO | BackofficeAdhesionTokenError> {
    const validation = await validateBackofficeAdhesionToken(token)
    if (validation.status !== "valid") {
      return tokenError(validation.status)
    }
    if (!validation.adhesionId) {
      return tokenError("not_found")
    }

    let adhesion = await this.repo.findById(validation.adhesionId)
    if (!adhesion) {
      return tokenError("not_found")
    }

    if (isAdhesionAccountActivated(adhesion)) {
      throw new Error(
        "Assinatura já ativada. Use o link de fatura das parcelas pendentes para pagamento."
      )
    }

    if (adhesion.asaasPaymentId) {
      if (adhesion.status === "paid") {
        return mapPayment(adhesion)
      }

      const requestedBillingType = input.billingType ?? "PIX"
      const isSameBillingType = adhesion.billingType === requestedBillingType

      if (isSameBillingType && requestedBillingType === "PIX") {
        return mapPayment(adhesion)
      }

      adhesion = await this.cancelExistingCheckoutPayments(adhesion)
    } else if (readInstallmentLedger(adhesion.installmentLedger).some((entry) => entry.asaasPaymentId)) {
      adhesion = await this.cancelExistingCheckoutPayments(adhesion)
    }

    const crmProduct = await this.getProductForAdhesion(
      CRM_PRODUCT_SLUG,
      adhesion.productId
    )
    const paymentRules = crmProduct?.paymentRules ?? []
    const cardRule = paymentRules.find(
      (rule) => rule.billingCycle === adhesion.cycle && rule.paymentMethod === "CREDIT_CARD"
    )
    const maxCardInstallments =
      cardRule?.maxInstallments ?? BACKOFFICE_ADHESION_CYCLE_MONTHS[adhesion.cycle] ?? 1

    const normalized = this.normalizeCheckoutInput(input, adhesion.cycle, maxCardInstallments)
    const existingProfileId = await this.repo.findProfileIdByEmail(normalized.email)
    if (existingProfileId) {
      throw new Error("Já existe uma conta cadastrada com este e-mail")
    }

    const publicDetails = mapPublicAdhesion(adhesion, paymentRules)
    const customerId = await this.ensureAsaasCustomer(adhesion, normalized)

    if (usesCustomInstallmentCheckout(adhesion, paymentRules, normalized.billingType)) {
      const ledger = readInstallmentLedger(adhesion.installmentLedger)
      const pending = ledger.filter((entry) => entry.status === "pending")
      if (pending.length === 0) {
        throw new Error("Não há parcelas pendentes para checkout")
      }

      const [firstPending, ...remainingPending] = pending
      const firstResult = await this.createAsaasPayment(
        adhesion,
        customerId,
        normalized,
        firstPending.amount,
        { singleCharge: true }
      )

      let nextLedger = ledger.map((entry) =>
        entry.index === firstPending.index
          ? { ...entry, asaasPaymentId: firstResult.paymentId }
          : entry
      )

      if (remainingPending.length > 0) {
        try {
          nextLedger = await this.chargePendingInstallments({
            adhesion,
            customerId,
            email: normalized.email,
            billingType: "CREDIT_CARD",
            ledger: nextLedger,
            pending: remainingPending,
          })
        } catch (chargeError) {
          try {
            await asaasFetch(`${asaasApi.payments}/${firstResult.paymentId}`, {
              method: "DELETE",
            })
          } catch (rollbackErr) {
            console.error(
              "[BackofficeAdhesionService][createCheckout][rollback-first-payment]",
              rollbackErr
            )
          }
          throw chargeError
        }
      }

      await this.persistInstallmentLedger(adhesion.id, nextLedger, {
        email: normalized.email,
        cpfCnpj: normalized.cpfCnpj,
        asaasCustomerId: customerId,
        billingType: normalized.billingType,
      })

      const updated = await this.repo.updateCheckoutData(adhesion.id, {
        fullName: normalized.fullName,
        phone: normalized.phone,
        email: normalized.email,
        cpfCnpj: normalized.cpfCnpj,
        postalCode: normalized.postalCode,
        address: normalized.address,
        addressNumber: normalized.addressNumber,
        neighborhood: normalized.neighborhood,
        complement: normalized.complement,
        city: normalized.city,
        state: normalized.state,
        asaasCustomerId: customerId,
        asaasPaymentId: firstResult.paymentId,
        asaasInstallmentId: null,
        installmentCount: pending.length,
        billingType: normalized.billingType,
        paymentDueDate: firstResult.paymentDueDate,
        invoiceUrl: firstResult.invoiceUrl,
        bankSlipUrl: firstResult.bankSlipUrl,
        pixQrCode: firstResult.pix?.encodedImage ?? null,
        pixPayload: firstResult.pix?.payload ?? null,
      })

      return {
        ...mapPayment(updated),
        pix: firstResult.pix,
        boleto: firstResult.boleto,
      }
    }

    const chargeAmount = resolveCheckoutChargeAmount(publicDetails, normalized.billingType)

    const paymentResult = await this.createAsaasPayment(adhesion, customerId, normalized, chargeAmount)
    const updated = await this.repo.updateCheckoutData(adhesion.id, {
      fullName: normalized.fullName,
      phone: normalized.phone,
      email: normalized.email,
      cpfCnpj: normalized.cpfCnpj,
      postalCode: normalized.postalCode,
      address: normalized.address,
      addressNumber: normalized.addressNumber,
      neighborhood: normalized.neighborhood,
      complement: normalized.complement,
      city: normalized.city,
      state: normalized.state,
      asaasCustomerId: customerId,
      asaasPaymentId: paymentResult.paymentId,
      asaasInstallmentId: paymentResult.installmentId ?? null,
      installmentCount: normalized.billingType === "CREDIT_CARD" ? (normalized.installments ?? null) : null,
      billingType: normalized.billingType,
      paymentDueDate: paymentResult.paymentDueDate,
      invoiceUrl: paymentResult.invoiceUrl,
      bankSlipUrl: paymentResult.bankSlipUrl,
      pixQrCode: paymentResult.pix?.encodedImage ?? null,
      pixPayload: paymentResult.pix?.payload ?? null,
    })

    return {
      ...mapPayment(updated),
      pix: paymentResult.pix,
      boleto: paymentResult.boleto,
    }
  }

  async getPaymentStatus(
    token: string,
    options?: { sync?: boolean }
  ): Promise<BackofficeAdhesionPaymentDTO | BackofficeAdhesionTokenError> {
    const validation = await validateBackofficeAdhesionToken(token, {
      allowedStatuses: ["pending", "paid", "overdue", "expired", "canceled"],
      expirePendingToken: false,
    })
    if (validation.status !== "valid") {
      return tokenError(validation.status)
    }
    if (!validation.adhesionId) {
      return tokenError("not_found")
    }

    let adhesion = await this.repo.findById(validation.adhesionId)
    if (!adhesion) {
      return tokenError("not_found")
    }

    if (options?.sync && adhesion.asaasPaymentId) {
      adhesion = await this.syncPaymentStatusFromAsaas(adhesion)
    }

    return mapPayment(adhesion)
  }

  /**
   * Fallback de processPaymentWebhook quando o pagamento não é achado nem
   * por asaasPaymentId nem pelo ledger: resolve a adesão pelo id interno
   * (extraído do externalReference) e, mesmo assim, confirma que ela
   * pertence à conta do evento (E4/C33) — um id interno nunca colide entre
   * contas, mas nada impede um evento com externalReference forjado ou de
   * uma conta errada apontar para uma adesão real de outra conta.
   */
  private async findByIdMatchingAccount(
    adhesionId: string,
    account: AsaasAccountId
  ): Promise<BackofficeAdhesionWithRelations | null> {
    const adhesion = await this.repo.findById(adhesionId)
    if (!adhesion || adhesion.asaasAccount !== account) return null
    return adhesion
  }

  async processPaymentWebhook(
    event: string,
    payment: BackofficeAdhesionPaymentWebhookInput,
    account: AsaasAccountId,
    options?: { deferEmailDelivery?: boolean }
  ): Promise<{ processed: boolean; adhesionId?: string }> {
    if (!payment.id) {
      return { processed: false }
    }

    const parsedRef = parseAdhesionExternalReference(payment.externalReference)
    const adhesion =
      (await this.repo.findByAsaasPaymentId(payment.id, account)) ??
      (await this.repo.findByLedgerAsaasPaymentId(payment.id, account)) ??
      (parsedRef ? await this.findByIdMatchingAccount(parsedRef.adhesionId, account) : null)

    if (!adhesion) {
      console.info("[BackofficeAdhesionService][processPaymentWebhook] adesão não encontrada", {
        paymentId: payment.id,
        externalReference: payment.externalReference ?? null,
        event,
        account,
      })
      return { processed: false }
    }

    const ledger = readInstallmentLedger(adhesion.installmentLedger)
    const installmentIndexFromLedger = ledger.findIndex(
      (entry) => entry.asaasPaymentId === payment.id
    )
    const installmentIndex =
      parsedRef?.installmentIndex ??
      (installmentIndexFromLedger >= 0 ? installmentIndexFromLedger : null)

    if (installmentIndex != null && ledger.length > 0) {
      return this.processInstallmentPaymentWebhook({
        event,
        payment,
        adhesion,
        ledger,
        installmentIndex,
        options,
      })
    }

    const status = payment.status?.toUpperCase() ?? ""
    const isPaid =
      PAID_ASAAS_STATUSES.has(status) ||
      event === "PAYMENT_RECEIVED" ||
      event === "PAYMENT_CONFIRMED" ||
      event === "PAYMENT_APPROVED"
    const isOverdue = OVERDUE_ASAAS_STATUSES.has(status) || event === "PAYMENT_OVERDUE"
    const isCanceled =
      CANCELED_ASAAS_STATUSES.has(status) ||
      event === "PAYMENT_REFUNDED" ||
      event === "PAYMENT_DELETED" ||
      event === "PAYMENT_CREDIT_CARD_CAPTURE_REFUSED"

    if (isPaid) {
      const paidAt = this.resolvePaymentDate(payment) ?? new Date()
      const updated = await this.repo.updateStatus(adhesion.id, "paid", { paidAt })
      try {
        await this.ensureAccountForPaidAdhesion(updated, {
          deferEmailDelivery: options?.deferEmailDelivery,
        })
      } catch (accountError) {
        console.error("[BackofficeAdhesionService][processPaymentWebhook][ensureAccount]", {
          adhesionId: adhesion.id,
          error: accountError,
        })
        throw accountError
      }
      return { processed: true, adhesionId: adhesion.id }
    }

    if (isOverdue) {
      await this.repo.updateStatus(adhesion.id, "overdue", { overdueAt: new Date() })
      return { processed: true, adhesionId: adhesion.id }
    }

    if (isCanceled) {
      await this.repo.updateStatus(adhesion.id, "canceled", { canceledAt: new Date() })
      return { processed: true, adhesionId: adhesion.id }
    }

    return { processed: true, adhesionId: adhesion.id }
  }

  private async processInstallmentPaymentWebhook(input: {
    event: string
    payment: BackofficeAdhesionPaymentWebhookInput
    adhesion: BackofficeAdhesionWithRelations
    ledger: AdhesionInstallmentLedgerEntry[]
    installmentIndex: number
    options?: { deferEmailDelivery?: boolean }
  }): Promise<{ processed: boolean; adhesionId?: string }> {
    const { event, payment, adhesion, options } = input
    const status = payment.status?.toUpperCase() ?? ""
    const isPaid =
      PAID_ASAAS_STATUSES.has(status) ||
      event === "PAYMENT_RECEIVED" ||
      event === "PAYMENT_CONFIRMED" ||
      event === "PAYMENT_APPROVED"
    const isOverdue = OVERDUE_ASAAS_STATUSES.has(status) || event === "PAYMENT_OVERDUE"
    const isCanceled =
      CANCELED_ASAAS_STATUSES.has(status) ||
      event === "PAYMENT_REFUNDED" ||
      event === "PAYMENT_DELETED" ||
      event === "PAYMENT_CREDIT_CARD_CAPTURE_REFUSED"

    const paymentId = payment.id ?? null
    const entryPreview =
      input.ledger.find((item) => item.index === input.installmentIndex) ??
      input.ledger[input.installmentIndex]
    if (!entryPreview) {
      console.info("[BackofficeAdhesionService][processInstallmentPaymentWebhook] parcela ausente", {
        adhesionId: adhesion.id,
        installmentIndex: input.installmentIndex,
        paymentId: payment.id,
      })
      return { processed: false, adhesionId: adhesion.id }
    }

    const updated = await this.repo.mutateInstallmentLedger(adhesion.id, (raw) => {
      const ledger = readInstallmentLedger(raw)
      const entry =
        ledger.find((item) => item.index === input.installmentIndex) ??
        ledger[input.installmentIndex]
      if (!entry) return raw

      return ledger.map((item) => {
        if (item.index !== entry.index) return item
        if (isPaid) {
          const paidAt = (this.resolvePaymentDate(payment) ?? new Date()).toISOString()
          return {
            ...item,
            status: "paid" as const,
            paymentSource: "ASAAS" as const,
            asaasPaymentId: paymentId,
            paidAt,
          }
        }
        if (isCanceled) {
          return {
            ...item,
            status: "pending" as const,
            asaasPaymentId: item.asaasPaymentId === paymentId ? null : item.asaasPaymentId,
            paidAt: null,
          }
        }
        return {
          ...item,
          asaasPaymentId: paymentId,
        }
      })
    })

    const nextLedger = readInstallmentLedger(updated.installmentLedger)

    if (isPaid) {
      const allPaid = nextLedger.every((item) => item.status === "paid")
      if (allPaid) {
        const paidAt = this.resolvePaymentDate(payment) ?? new Date()
        const paidAdhesion = await this.repo.updateStatus(updated.id, "paid", { paidAt })
        try {
          await this.ensureAccountForPaidAdhesion(paidAdhesion, {
            deferEmailDelivery: options?.deferEmailDelivery,
          })
        } catch (accountError) {
          console.error(
            "[BackofficeAdhesionService][processInstallmentPaymentWebhook][ensureAccount]",
            { adhesionId: updated.id, error: accountError }
          )
          throw accountError
        }
      }
      return { processed: true, adhesionId: updated.id }
    }

    if (isOverdue && updated.status !== "paid") {
      await this.repo.updateStatus(updated.id, "overdue", { overdueAt: new Date() })
      return { processed: true, adhesionId: updated.id }
    }

    if (isCanceled) {
      await this.reconcileAdhesionAfterInstallmentCancellation(updated, nextLedger)
      return { processed: true, adhesionId: updated.id }
    }

    return { processed: true, adhesionId: updated.id }
  }

  private async reconcileAdhesionAfterInstallmentCancellation(
    adhesion: BackofficeAdhesionWithRelations,
    ledger: AdhesionInstallmentLedgerEntry[]
  ): Promise<void> {
    const allPaid = ledger.every((item) => item.status === "paid")
    const hasAnyPaid = ledger.some((item) => item.status === "paid")

    if (adhesion.status === "paid" && !allPaid) {
      await this.repo.update(adhesion.id, { status: "pending", paidAt: null })
      await this.userSubscriptionRepo.cancelActiveByAdhesionId(adhesion.id)
      if (adhesion.createdProfileId) {
        await this.repo.revokePaidAdhesionAccess(adhesion.createdProfileId)
      }
      return
    }

    if (adhesion.status !== "paid" && !hasAnyPaid) {
      await this.repo.updateStatus(adhesion.id, "canceled", { canceledAt: new Date() })
    }
  }

  private async invalidateTokenAfterPayment(adhesionId: string): Promise<void> {
    const token = generateBackofficeAdhesionToken()
    await this.repo.update(adhesionId, {
      tokenHash: hashBackofficeAdhesionToken(token),
      tokenPreview: getBackofficeAdhesionTokenPreview(token),
      expiresAt: expireTokenNow(),
      tokenPlain: null,
    })
  }

  private normalizeCommercialInput(
    input: BackofficeAdhesionCreateInput & { leadId: string }
  ): BackofficeAdhesionCreateInput {
    const fullName = normalizeText(input.fullName)
    if (!fullName || fullName.length < 2) {
      throw new Error("Nome completo deve ter pelo menos 2 caracteres")
    }

    const phone = normalizeDigits(input.phone, 11)
    if (phone && !/^\d{10,11}$/.test(phone)) {
      throw new Error("Celular deve conter 10 ou 11 dígitos")
    }

    const extraTeams = Math.max(0, Math.trunc(input.extraTeams || 0))
    const extraUsers = Math.max(0, Math.trunc(input.extraUsers || 0))
    const activationMode = input.activationMode ?? "checkout"
    const billingType =
      input.billingType === "CREDIT_CARD"
        ? "CREDIT_CARD"
        : "PIX"
    const email = normalizeText(input.email)?.toLowerCase() ?? null
    const cpfCnpj = normalizeDigits(input.cpfCnpj, 14)

    if (
      activationMode === "external_paid" ||
      input.userType === "guest" ||
      (input.externalInstallmentIndexes?.length ?? 0) > 0
    ) {
      if (!email || !isValidEmail(email)) {
        throw new Error("E-mail inválido")
      }
    }

    if (cpfCnpj && !/^\d{11}$|^\d{14}$/.test(cpfCnpj)) {
      throw new Error("CPF/CNPJ inválido")
    }

    return {
      leadId: input.leadId,
      fullName,
      phone: phone || "",
      email,
      cpfCnpj: cpfCnpj || null,
      productId: input.productId ?? null,
      cycle: input.cycle,
      extraTeams,
      extraUsers,
      sdrBackofficeUserId: normalizeText(input.sdrBackofficeUserId),
      closerBackofficeUserId: normalizeText(input.closerBackofficeUserId),
      activationMode,
      billingType,
      userType: input.userType ?? "common",
      accessExpiresAt: input.accessExpiresAt ?? null,
      sponsorMasterId: normalizeText(input.sponsorMasterId) ?? null,
      multiskillEnabled: input.multiskillEnabled === true,
      hasUnlimitedUsers:
        input.cycle === "annual" ||
        input.userType === "member_pro" ||
        input.hasUnlimitedUsers === true,
      additionalUsers: input.additionalUsers ?? [],
      additionalTeams: input.additionalTeams ?? [],
      externalInstallmentIndexes: input.externalInstallmentIndexes ?? [],
    }
  }

  private normalizeCheckoutInput(
    input: BackofficeAdhesionCheckoutInput,
    cycle: BackofficeAdhesionBillingCycle,
    maxCardInstallments: number
  ): BackofficeAdhesionCheckoutInput {
    const fullName = normalizeText(input.fullName)
    const email = normalizeText(input.email)?.toLowerCase()
    const phone = normalizeDigits(input.phone, 11)
    const cpfCnpj = normalizeDigits(input.cpfCnpj, 14)
    const postalCode = normalizeDigits(input.postalCode, 8)
    const address = normalizeText(input.address)
    const addressNumber = normalizeText(input.addressNumber)
    const neighborhood = normalizeText(input.neighborhood)
    const city = normalizeText(input.city)
    const state = normalizeText(input.state)?.toUpperCase()

    if (!fullName || fullName.length < 2) throw new Error("Nome completo inválido")
    if (!email || !isValidEmail(email)) throw new Error("E-mail inválido")
    if (!/^\d{10,11}$/.test(phone)) throw new Error("Telefone inválido")
    if (!/^\d{11}$|^\d{14}$/.test(cpfCnpj)) throw new Error("CPF/CNPJ inválido")
    if (!/^\d{8}$/.test(postalCode)) throw new Error("CEP inválido")
    if (!address || !addressNumber || !neighborhood || !city || !state || state.length !== 2) {
      throw new Error("Endereço incompleto")
    }

    if (input.billingType === "CREDIT_CARD" && !input.creditCard) {
      throw new Error("Dados do cartão são obrigatórios")
    }

    const maxInstallments = Math.max(1, Math.trunc(maxCardInstallments || 1))
    const installments = Math.min(
      Math.max(1, Math.trunc(input.installments || maxInstallments)),
      maxInstallments
    )

    return {
      ...input,
      fullName,
      email,
      phone,
      cpfCnpj,
      postalCode,
      address,
      addressNumber,
      neighborhood,
      city,
      state,
      complement: normalizeText(input.complement),
      installments,
    }
  }

  /**
   * E5 de [[10 — Fundações Multi-conta — Backend]] (DA5/M4.8): criação de
   * customer via AsaasCustomerGateway — nunca POST /customers direto. Estes
   * dois caminhos criam o customer ANTES de existir um Profile (checkout de
   * adesão pré-conversão), por isso usam `adhesionId` em vez de `profileId`
   * — o gateway resolve o mesmo `externalReference` que já era montado à
   * mão aqui (`backoffice-adhesion-<id>`), e agora também fixa
   * `notificationDisabled: true`, que faltava nos dois (§4 da auditoria).
   */
  private async ensureAsaasCustomer(
    adhesion: BackofficeAdhesionWithRelations,
    input: BackofficeAdhesionCheckoutInput
  ): Promise<string> {
    if (adhesion.asaasCustomerId) {
      return adhesion.asaasCustomerId
    }

    const customer = await asaasCustomerGateway.createCustomer({
      adhesionId: adhesion.id,
      name: input.fullName,
      email: input.email,
      cpfCnpj: input.cpfCnpj,
      mobilePhone: input.phone,
      postalCode: input.postalCode,
      address: input.address,
      addressNumber: input.addressNumber,
      complement: input.complement ?? undefined,
      province: input.neighborhood,
    })

    return customer.id
  }

  private async createExternalAsaasCustomer(input: {
    adhesionId: string
    fullName: string
    email: string
    cpfCnpj: string
    phone: string
  }): Promise<string> {
    const customer = await asaasCustomerGateway.createCustomer({
      adhesionId: input.adhesionId,
      name: input.fullName,
      email: input.email,
      cpfCnpj: input.cpfCnpj,
      mobilePhone: input.phone,
      observations: "Cliente criado via adesão com pagamento externo (sem fatura Asaas).",
    })

    return customer.id
  }

  private async createAsaasPayment(
    adhesion: BackofficeAdhesionWithRelations,
    customerId: string,
    input: BackofficeAdhesionCheckoutInput,
    chargeAmount: number,
    options?: { singleCharge?: boolean }
  ): Promise<{
    paymentId: string
    installmentId: string | null
    paymentDueDate: Date | null
    invoiceUrl: string | null
    bankSlipUrl: string | null
    pix?: { encodedImage: string; payload: string; expirationDate: string | null }
    boleto?: {
      bankSlipUrl: string | null
      identificationField: string
      barCode: string
      dueDate: string | null
    }
  }> {
    const ownerTz = DEFAULT_TZ
    const dueDate = formatIntimezone(new Date(), "yyyy-MM-dd", ownerTz)
    const payload: Record<string, unknown> = {
      customer: customerId,
      billingType: input.billingType,
      value: chargeAmount,
      dueDate,
      description: `Corretor Studio - Nova adesão ${BACKOFFICE_ADHESION_CYCLE_LABELS[adhesion.cycle]}`,
      externalReference: `backoffice-adhesion-${adhesion.id}`,
    }

    if (input.billingType === "CREDIT_CARD" && input.creditCard) {
      payload.creditCard = input.creditCard
      payload.creditCardHolderInfo = {
        name: input.fullName,
        email: input.email,
        cpfCnpj: input.cpfCnpj,
        postalCode: input.postalCode,
        addressNumber: input.addressNumber,
        addressComplement: input.complement ?? null,
        phone: input.phone,
        mobilePhone: input.phone,
      }
      payload.remoteIp = input.remoteIp
      if (!options?.singleCharge && (input.installments ?? 1) > 1) {
        payload.installmentCount = input.installments
        payload.installmentValue = roundCurrency(chargeAmount / Math.max(input.installments ?? 1, 1))
      }
    }

    const payment = await asaasFetch(asaasApi.payments, {
      method: "POST",
      body: JSON.stringify(payload),
    })

    const result = {
      paymentId: String(payment.id),
      installmentId: payment.installment ? String(payment.installment) : null,
      paymentDueDate: payment.dueDate ? new Date(`${payment.dueDate}T00:00:00`) : null,
      invoiceUrl: (payment.invoiceUrl as string | undefined) ?? null,
      bankSlipUrl: (payment.bankSlipUrl as string | undefined) ?? null,
      pix: undefined as
        | { encodedImage: string; payload: string; expirationDate: string | null }
        | undefined,
      boleto: undefined as
        | {
            bankSlipUrl: string | null
            identificationField: string
            barCode: string
            dueDate: string | null
          }
        | undefined,
    }

    if (input.billingType === "PIX") {
      const pix = await asaasFetch(asaasApi.pixQrCode(result.paymentId), { method: "GET" })
      result.pix = {
        encodedImage: String(pix.encodedImage ?? ""),
        payload: String(pix.payload ?? ""),
        expirationDate: pix.expirationDate ? String(pix.expirationDate) : null,
      }
    }

    return result
  }

  private async syncPaymentStatusFromAsaas(
    adhesion: BackofficeAdhesionWithRelations
  ): Promise<BackofficeAdhesionWithRelations> {
    if (!adhesion.asaasPaymentId) {
      return adhesion
    }

    // C33: a cobrança pertence à conta gravada na própria adesão, não
    // sempre à primary — sync de uma adesão legacy contra a conta errada
    // retorna 404 ou lê o pagamento de outra conta.
    const asaasClient = createAsaasClient(adhesion.asaasAccount)
    const payment = (await asaasClient.request(
      `${asaasClient.endpoints.payments}/${adhesion.asaasPaymentId}`,
      { method: "GET" }
    )) as BackofficeAdhesionPaymentWebhookInput

    const status = payment.status?.toUpperCase() ?? ""
    if (status === "PENDING") {
      return adhesion
    }

    await this.processPaymentWebhook(mapSyncedPaymentEvent(payment), payment, adhesion.asaasAccount)

    const updated = await this.repo.findById(adhesion.id)
    if (!updated) {
      throw new Error("Adesão não encontrada após sincronização")
    }

    return updated
  }

  private resolvePaymentDate(payment: BackofficeAdhesionPaymentWebhookInput): Date | null {
    const value = payment.clientPaymentDate ?? payment.paymentDate ?? payment.confirmedDate
    if (!value) return null
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }

  private async ensureAccountForPaidAdhesion(
    adhesion: BackofficeAdhesionWithRelations,
    options?: { deferEmailDelivery?: boolean }
  ): Promise<void> {
    if (adhesion.createdSupabaseId || adhesion.createdProfileId) {
      if (adhesion.createdProfileId) {
        await this.ensureUserSubscriptionForPaidAdhesion(adhesion, adhesion.createdProfileId)
      }
      return
    }
    if (!adhesion.email) {
      throw new Error("Adesão paga sem dados suficientes para criar conta")
    }

    const supabaseAdmin = createSupabaseAdmin()
    if (!supabaseAdmin) {
      throw new Error("Supabase Admin não configurado")
    }

    const redirectTo = getFullUrl("/set-password")
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "invite",
      email: adhesion.email,
      options: {
        redirectTo,
        data: {
          name: adhesion.fullName,
          invited: true,
          first_access: true,
        },
      },
    })

    // Extract supabaseId before guards so we can clean up if parsing fails
    const supabaseId = linkData?.user?.id

    if (linkError || !linkData?.properties?.action_link || !supabaseId) {
      if (supabaseId) {
        await supabaseAdmin.auth.admin.deleteUser(supabaseId).catch((deleteError) => {
          console.error("[BackofficeAdhesionService][ensureAccountForPaidAdhesion][invite-rollback]", deleteError)
        })
      }
      throw new Error(linkError?.message || "Erro ao criar convite de acesso")
    }

    let provisionedProfileId: string | null = null

    try {
      const cycleMonths = BACKOFFICE_ADHESION_CYCLE_MONTHS[adhesion.cycle] ?? 1
      const subscriptionStartDate = adhesion.paidAt ?? new Date()
      const subscriptionEndDate = addMonthsInTz(subscriptionStartDate, cycleMonths, DEFAULT_TZ)

      const isGuest = adhesion.requestedUserTypeSlug === "guest"
      let resolvedSponsorMasterId = adhesion.sponsorMasterId ?? null

      if (resolvedSponsorMasterId) {
        const sponsorProfile = await this.sponsorAuthorizationRepo.findProfileById(resolvedSponsorMasterId)
        const authorization = sponsorProfile
          ? await this.sponsorAuthorizationRepo.findActiveAuthorization(resolvedSponsorMasterId)
          : null
        const isAuthorized = Boolean(
          sponsorProfile?.isMaster && authorization?.isActive
        )
        if (!isAuthorized) {
          console.error(
            "[BackofficeAdhesionService][ensureAccountForPaidAdhesion] patrocinador revogado ou inválido; conta será criada sem vínculo",
            { adhesionId: adhesion.id, sponsorMasterId: resolvedSponsorMasterId }
          )
          resolvedSponsorMasterId = null
        }
      }

      const createdProfile = await this.repo.createPaidManagerProfile({
        supabaseId,
        fullName: adhesion.fullName,
        phone: adhesion.phone,
        email: adhesion.email,
        asaasCustomerId: adhesion.asaasCustomerId,
        cpfCnpj: adhesion.cpfCnpj,
        subscriptionId: adhesion.billingType === "EXTERNAL"
          ? `external-adhesion-${adhesion.id}`
          : adhesion.asaasPaymentId ?? `adhesion-${adhesion.id}`,
        operatorCount: adhesion.extraUsers,
        subscriptionStartDate,
        postalCode: adhesion.postalCode,
        address: adhesion.address,
        addressNumber: adhesion.addressNumber,
        neighborhood: adhesion.neighborhood,
        complement: adhesion.complement,
        city: adhesion.city,
        state: adhesion.state,
        hasPermanentSubscription: isGuest,
        hasUnlimitedUsers:
          isGuest ||
          adhesion.hasUnlimitedUsers === true ||
          adhesion.cycle === "annual" ||
          adhesion.requestedUserTypeSlug === "member_pro",
        multiskillEnabled: adhesion.multiskillEnabled ?? false,
        sponsorMasterId: resolvedSponsorMasterId,
      })

      await this.repo.activateCreatedProfileSubscription(createdProfile.profileId, {
        subscriptionEndDate,
        subscriptionCycle: adhesion.cycle,
        subscriptionNextDueDate: subscriptionEndDate,
      })

      await this.repo.markAccountCreated(adhesion.id, {
        createdProfileId: createdProfile.profileId,
        createdSupabaseId: createdProfile.supabaseId,
      })

      const assignedByProfileId = await this.resolveAssignedByProfileId(
        adhesion.createdByBackofficeUserId
      )

      if (adhesion.requestedUserTypeSlug === "member_pro" && adhesion.requestedMemberProAccessExpiresAt) {
        await this.allUsersRepo.upsertUserTypeAssignment(createdProfile.profileId, {
          userType: "member_pro",
          accessExpiresAt: adhesion.requestedMemberProAccessExpiresAt,
          assignedByProfileId,
        })
        await this.allUsersRepo.setHasUnlimitedUsers(createdProfile.profileId, true)
      } else if (adhesion.requestedUserTypeSlug === "guest") {
        await this.allUsersRepo.upsertUserTypeAssignment(createdProfile.profileId, {
          userType: "guest",
          accessExpiresAt: null,
          assignedByProfileId,
        })
      } else if (adhesion.requestedUserTypeSlug === "associate") {
        await this.allUsersRepo.upsertUserTypeAssignment(createdProfile.profileId, {
          userType: "associate",
          accessExpiresAt: null,
          assignedByProfileId,
        })
      }

      await this.ensureUserSubscriptionForPaidAdhesion(adhesion, createdProfile.profileId)

      const crmProduct = await this.getProductForAdhesion(CRM_PRODUCT_SLUG, adhesion.productId)
      await this.repo.upsertProfileSubscription({
        profileId: createdProfile.profileId,
        adhesionId: adhesion.id,
        productId: crmProduct.id,
        subscriptionStatus: "active",
        subscriptionPlan: "manager_base",
        subscriptionCycle: adhesion.cycle,
        subscriptionStartDate,
        subscriptionEndDate,
        subscriptionNextDueDate: subscriptionEndDate,
      })

      provisionedProfileId = createdProfile.profileId
    } catch (accountError) {
      await supabaseAdmin.auth.admin.deleteUser(supabaseId).catch((deleteError) => {
        console.error("[BackofficeAdhesionService][ensureAccountForPaidAdhesion][rollback]", deleteError)
      })
      throw accountError
    }

    if (!provisionedProfileId) {
      return
    }

    await this.invalidateTokenAfterPayment(adhesion.id)

    const deliverInviteEmail = async () => {
      try {
        await this.sendSetPasswordEmail(
          { ...adhesion, createdProfileId: provisionedProfileId },
          "invite",
          linkData
        )
      } catch (emailError) {
        console.error(
          "[BackofficeAdhesionService][ensureAccountForPaidAdhesion][invite-email]",
          {
            adhesionId: adhesion.id,
            profileId: provisionedProfileId,
            error: emailError,
          }
        )
      }
    }

    if (options?.deferEmailDelivery) {
      void deliverInviteEmail()
      return
    }

    await deliverInviteEmail()
  }

  private async resolvePricingOptions(): Promise<
    BackofficeAdhesionOptionsDTO["pricing"]["cycles"]
  > {
    const [crmWithRules, extraTeamProduct, extraUserProduct] = await Promise.all([
      this.getProductForAdhesion(CRM_PRODUCT_SLUG),
      this.getDefaultProductByFeatureSlug(EXTRA_TEAM_PRODUCT_SLUG),
      this.getDefaultProductByFeatureSlug(EXTRA_USER_PRODUCT_SLUG),
    ])

    if (!crmWithRules?.isActive) {
      throw new Error(`Produto obrigatório indisponível: ${CRM_PRODUCT_SLUG}`)
    }

    const cycles = Object.keys(BACKOFFICE_ADHESION_CYCLE_MONTHS) as BackofficeAdhesionBillingCycle[]

    const entries = cycles.map((cycle) => {
      const baseMonthlyPrice = resolveProductPriceForCycle(crmWithRules, cycle)
      const extraTeamPrice = resolveProductPriceForCycle(extraTeamProduct, cycle)
      const extraUserPrice = resolveProductPriceForCycle(extraUserProduct, cycle)

      const pixRule = crmWithRules.paymentRules.find(
        (r) => r.billingCycle === cycle && r.paymentMethod === "PIX"
      )
      const cardRule = crmWithRules.paymentRules.find(
        (r) => r.billingCycle === cycle && r.paymentMethod === "CREDIT_CARD"
      )

      return [cycle, {
        baseMonthlyPrice,
        extraTeamPrice,
        extraUserPrice,
        pixBaseMonthlyPrice: pixRule ? Number(pixRule.price.toString()) : null,
        cardBaseMonthlyPrice: cardRule
          ? resolveCardMonthlyPriceFromRule(cardRule, cycle)
          : null,
      }] as const
    })

    return Object.fromEntries(entries) as BackofficeAdhesionOptionsDTO["pricing"]["cycles"]
  }

  private async resolvePrices(
    cycle: BackofficeAdhesionBillingCycle,
    baseProductId?: string | null
  ): Promise<BackofficeAdhesionPrices> {
    const [crmProduct, extraTeamProduct, extraUserProduct] = await Promise.all([
      baseProductId
        ? this.productRepo.findById(baseProductId).then((product) => {
            if (!product?.isActive) {
              throw new Error(`Produto obrigatório indisponível: ${CRM_PRODUCT_SLUG}`)
            }
            return product
          })
        : this.getDefaultProductByFeatureSlug(CRM_PRODUCT_SLUG),
      this.getDefaultProductByFeatureSlug(EXTRA_TEAM_PRODUCT_SLUG),
      this.getDefaultProductByFeatureSlug(EXTRA_USER_PRODUCT_SLUG),
    ])

    return {
      baseMonthlyPrice: resolveProductPriceForCycle(crmProduct, cycle),
      extraTeamPrice: resolveProductPriceForCycle(extraTeamProduct, cycle),
      extraUserPrice: resolveProductPriceForCycle(extraUserProduct, cycle),
    }
  }

  private async getDefaultProductByFeatureSlug(featureSlug: string): Promise<BackofficeProduct> {
    const product = await this.productRepo.findDefaultByFeatureSlug(featureSlug)
    if (!product || !product.isActive) {
      throw new Error(`Produto obrigatório indisponível: ${featureSlug}`)
    }
    return product
  }

  private async getProductForAdhesion(
    featureSlug: string,
    productId?: string | null
  ): Promise<BackofficeProductWithPaymentRules> {
    if (productId) {
      const product = await this.productRepo.findByIdWithPaymentRules(productId)
      if (!product || !product.isActive || !productHasFeatureSlug(product, featureSlug)) {
        throw new Error(`Variante de produto inválida para ${featureSlug}`)
      }
      return product
    }

    const product = await this.productRepo.findDefaultByFeatureSlugWithPaymentRules(featureSlug)
    if (!product || !product.isActive) {
      throw new Error(`Produto obrigatório indisponível: ${featureSlug}`)
    }
    return product
  }

  private mapProductVariants(
    products: BackofficeProductWithPaymentRules[]
  ): BackofficeAdhesionOptionsDTO["productVariants"] {
    const cycleOrder = Object.keys(BACKOFFICE_ADHESION_CYCLE_MONTHS) as BackofficeAdhesionBillingCycle[]

    return products.map((product) => {
      const availableCycles = cycleOrder.filter((cycle) =>
        product.paymentRules.some((rule) => rule.billingCycle === cycle)
      )
      const pricesByCycle: BackofficeAdhesionOptionsDTO["productVariants"][number]["pricesByCycle"] = {}
      const installmentByCycle: BackofficeAdhesionOptionsDTO["productVariants"][number]["installmentByCycle"] =
        {}

      for (const cycle of availableCycles) {
        const pixRule = product.paymentRules.find(
          (rule) => rule.billingCycle === cycle && rule.paymentMethod === "PIX"
        )
        const cardRule = product.paymentRules.find(
          (rule) => rule.billingCycle === cycle && rule.paymentMethod === "CREDIT_CARD"
        )
        pricesByCycle[cycle] = {
          pixMonthlyPrice: pixRule ? Number(pixRule.price.toString()) : null,
          cardMonthlyPrice: cardRule
            ? resolveCardMonthlyPriceFromRule(cardRule, cycle)
            : null,
        }
        if (cardRule) {
          const schedule = Array.isArray(cardRule.installmentSchedule)
            ? (cardRule.installmentSchedule as number[])
            : []
          installmentByCycle[cycle] = {
            splitMode: (cardRule.installmentSplitMode as "EQUAL" | "CUSTOM") ?? "EQUAL",
            maxInstallments: cardRule.maxInstallments,
            schedule,
            cardTotal: Number(cardRule.price.toString()),
          }
        }
      }

      return {
        id: product.id,
        name: product.name,
        featureSlugs: product.featureSlugs,
        isDefault: product.isDefault,
        availableCycles,
        installmentByCycle,
        pricesByCycle,
      }
    })
  }

  private async persistInstallmentLedger(
    adhesionId: string,
    ledger: Array<{
      index: number
      amount: number
      paymentSource: "EXTERNAL" | "ASAAS"
      status: "paid" | "pending"
      asaasPaymentId: string | null
      paidAt: string | null
    }>,
    extras?: {
      email?: string
      cpfCnpj?: string | null
      asaasCustomerId?: string | null
      paidAt?: Date
      billingType?: string
    }
  ): Promise<void> {
    await this.repo.update(adhesionId, {
      installmentLedger: ledger,
      ...(extras?.email !== undefined ? { email: extras.email } : {}),
      ...(extras?.cpfCnpj !== undefined ? { cpfCnpj: extras.cpfCnpj } : {}),
      ...(extras?.asaasCustomerId !== undefined ? { asaasCustomerId: extras.asaasCustomerId } : {}),
      ...(extras?.paidAt !== undefined ? { paidAt: extras.paidAt } : {}),
      ...(extras?.billingType !== undefined ? { billingType: extras.billingType } : {}),
    })
  }

  private collectLedgerAsaasPaymentIds(ledger: AdhesionInstallmentLedgerEntry[]): string[] {
    const ids = new Set<string>()
    for (const entry of ledger) {
      if (entry.asaasPaymentId) ids.add(entry.asaasPaymentId)
    }
    return [...ids]
  }

  private async cancelAsaasPayments(paymentIds: string[]): Promise<void> {
    for (const paymentId of [...new Set(paymentIds)]) {
      try {
        await asaasFetch(`${asaasApi.payments}/${paymentId}`, { method: "DELETE" })
      } catch (error) {
        console.error("[BackofficeAdhesionService][cancelAsaasPayments]", { paymentId, error })
      }
    }
  }

  private resetPendingLedgerPaymentIds(
    ledger: AdhesionInstallmentLedgerEntry[]
  ): AdhesionInstallmentLedgerEntry[] {
    return ledger.map((entry) =>
      entry.status === "paid"
        ? entry
        : { ...entry, asaasPaymentId: null, paidAt: null }
    )
  }

  private async cancelExistingCheckoutPayments(
    adhesion: BackofficeAdhesionWithRelations
  ): Promise<BackofficeAdhesionWithRelations> {
    const ledger = readInstallmentLedger(adhesion.installmentLedger)
    const paymentIds = this.collectLedgerAsaasPaymentIds(ledger)
    if (adhesion.asaasPaymentId) {
      paymentIds.push(adhesion.asaasPaymentId)
    }

    if (paymentIds.length > 0) {
      await this.cancelAsaasPayments(paymentIds)
    }

    const resetLedger = this.resetPendingLedgerPaymentIds(ledger)
    const ledgerChanged = JSON.stringify(resetLedger) !== JSON.stringify(ledger)
    const hadMainPayment =
      Boolean(adhesion.asaasPaymentId) ||
      Boolean(adhesion.pixPayload) ||
      Boolean(adhesion.invoiceUrl)

    if (hadMainPayment) {
      await this.repo.update(adhesion.id, { installmentLedger: resetLedger })
      return this.repo.clearPaymentArtifacts(adhesion.id)
    }

    if (ledgerChanged) {
      return this.repo.update(adhesion.id, { installmentLedger: resetLedger })
    }

    return adhesion
  }

  private async chargePendingInstallments(input: {
    adhesion: BackofficeAdhesionWithRelations
    customerId: string
    email: string
    billingType: "PIX" | "CREDIT_CARD"
    ledger: Array<{
      index: number
      amount: number
      paymentSource: "EXTERNAL" | "ASAAS"
      status: "paid" | "pending"
      asaasPaymentId: string | null
      paidAt: string | null
    }>
    pending: Array<{
      index: number
      amount: number
      paymentSource: "EXTERNAL" | "ASAAS"
      status: "paid" | "pending"
      asaasPaymentId: string | null
      paidAt: string | null
    }>
  }): Promise<typeof input.ledger> {
    const next = [...input.ledger]
    const scheduleBaseDate = input.adhesion.createdAt
    const createdPaymentIds: string[] = []
    try {
      for (const entry of input.pending) {
        const dueDate = resolveAdhesionInstallmentDueDate(scheduleBaseDate, entry.index)
        const payment = await asaasFetch(asaasApi.payments, {
          method: "POST",
          body: JSON.stringify({
            customer: input.customerId,
            billingType: input.billingType,
            value: entry.amount,
            dueDate,
            description: `Corretor Studio - Parcela ${entry.index + 1} adesão ${BACKOFFICE_ADHESION_CYCLE_LABELS[input.adhesion.cycle]}`,
            externalReference: `backoffice-adhesion-${input.adhesion.id}-installment-${entry.index}`,
          }),
        })
        const paymentId = payment?.id ? String(payment.id) : null
        if (!paymentId) {
          throw new Error(`Falha ao criar cobrança Asaas da parcela ${entry.index + 1}`)
        }
        createdPaymentIds.push(paymentId)
        next[entry.index] = {
          ...next[entry.index],
          asaasPaymentId: paymentId,
        }
      }
      return next
    } catch (error) {
      for (const paymentId of createdPaymentIds) {
        try {
          await asaasFetch(`${asaasApi.payments}/${paymentId}`, { method: "DELETE" })
        } catch (rollbackErr) {
          console.error(
            "[BackofficeAdhesionService][chargePendingInstallments][rollback]",
            { paymentId, rollbackErr }
          )
        }
      }
      throw error
    }
  }

  private async ensureUserSubscriptionForPaidAdhesion(
    adhesion: BackofficeAdhesionWithRelations,
    profileId: string
  ): Promise<void> {
    const product = await this.getProductForAdhesion(CRM_PRODUCT_SLUG, adhesion.productId)
    const startDate = adhesion.paidAt ?? new Date()
    const cycleMonths = BACKOFFICE_ADHESION_CYCLE_MONTHS[adhesion.cycle] ?? 1
    const endDate = addMonthsInTz(startDate, cycleMonths, DEFAULT_TZ)

    await this.userSubscriptionRepo.upsertForAdhesion({
      profileId,
      productId: product.id,
      status: "active",
      cycle: adhesion.cycle,
      startDate,
      endDate,
      adhesionId: adhesion.id,
    })
  }

  private async sendSetPasswordEmail(
    adhesion: BackofficeAdhesionWithRelations,
    type: "invite" | "recovery",
    generatedLinkData?: { properties?: { action_link?: string; hashed_token?: string } }
  ): Promise<void> {
    if (!adhesion.email) {
      throw new Error("Adesão paga sem e-mail para envio de convite")
    }

    let linkData = generatedLinkData
    if (!linkData) {
      const supabaseAdmin = createSupabaseAdmin()
      if (!supabaseAdmin) {
        if (isE2eOrCiBypass()) {
          console.info("[BackofficeAdhesionService][sendSetPasswordEmail] E2E fallback link (no Supabase Admin)", {
            adhesionId: adhesion.id,
            email: adhesion.email,
          })
          linkData = {
            properties: {
              action_link: getFullUrl("/set-password"),
              hashed_token: `e2e-${Date.now()}`,
            },
          }
        } else {
          throw new Error("Supabase Admin não configurado")
        }
      } else {
        try {
        const { data, error } =
          type === "invite"
            ? await supabaseAdmin.auth.admin.generateLink({
                type: "invite",
                email: adhesion.email,
                options: {
                  redirectTo: getFullUrl("/set-password"),
                  data: {
                    name: adhesion.fullName,
                    invited: true,
                    first_access: true,
                  },
                },
              })
            : await supabaseAdmin.auth.admin.generateLink({
                type: "recovery",
                email: adhesion.email,
                options: {
                  redirectTo: getFullUrl("/set-password"),
                },
              })

        if (error || !data?.properties?.action_link) {
          if (isE2eOrCiBypass()) {
            console.info("[BackofficeAdhesionService][sendSetPasswordEmail] E2E fallback link", {
              adhesionId: adhesion.id,
              email: adhesion.email,
            })
            linkData = {
              properties: {
                action_link: getFullUrl("/set-password"),
                hashed_token: `e2e-${Date.now()}`,
              },
            }
          } else {
            throw new Error("Erro ao gerar link de convite")
          }
        } else {
          linkData = data
        }
      } catch (e) {
        if (isE2eOrCiBypass()) {
          console.info("[BackofficeAdhesionService][sendSetPasswordEmail] E2E fallback após exceção Supabase", {
            adhesionId: adhesion.id,
            email: adhesion.email,
            error: String(e),
          })
          linkData = {
            properties: {
              action_link: getFullUrl("/set-password"),
              hashed_token: `e2e-${Date.now()}`,
            },
          }
        } else {
          throw e
        }
      }
      }
    }

    const emailService = createEmailService()
    const result = await emailService.sendAdhesionCompletedEmail({
      userName: adhesion.fullName,
      userEmail: adhesion.email,
      setPasswordUrl: buildSetPasswordEmailAuthLink(linkData, type),
      profileId: adhesion.createdProfileId ?? undefined,
      adhesionId: adhesion.id,
    })

    if (!result.success) {
      if (isE2eOrCiBypass()) {
        console.info("[BackofficeAdhesionService][sendSetPasswordEmail] E2E skip email failure", {
          adhesionId: adhesion.id,
          error: result.error,
        })
        return
      }
      throw new Error(result.error || "Erro ao enviar e-mail de convite")
    }
  }

  private async syncAdhesionEmailArtifacts(
    adhesion: BackofficeAdhesionWithRelations,
    newEmail: string,
    _previousEmail: string | null
  ): Promise<void> {
    const trimmed = newEmail.trim()
    const normalizedNew = trimmed.toLowerCase()
    if (!normalizedNew) return

    // Preflight: já existe outra conta com este e-mail?
    const existingProfileId = await this.repo.findProfileIdByEmail(trimmed)
    if (existingProfileId && existingProfileId !== adhesion.createdProfileId) {
      throw new Error("Já existe uma conta cadastrada com este e-mail")
    }

    // Transação atômica para lead + profile
    const maybeRepo = this.repo as unknown as {
      syncLeadAndProfileEmails?: (input: { leadId: string; profileId: string | null; email: string }) => Promise<void>
      updateLeadEmail?: (id: string, email: string) => Promise<void>
      updateProfileEmail?: (id: string, email: string) => Promise<void>
    }

    if (maybeRepo.syncLeadAndProfileEmails) {
      await maybeRepo.syncLeadAndProfileEmails({
        leadId: adhesion.leadId,
        profileId: adhesion.createdProfileId ?? null,
        email: trimmed,
      })
    } else {
      // fallback legado mantido para testes unitários com mock parcial
      await maybeRepo.updateLeadEmail?.(adhesion.leadId, trimmed)
      if (adhesion.createdProfileId) {
        await maybeRepo.updateProfileEmail?.(adhesion.createdProfileId, trimmed)
      }
    }

    console.info("[BackofficeAdhesionService][syncEmail] db sincronizado", {
      adhesionId: adhesion.id,
    })

    if (adhesion.createdSupabaseId) {
      if (isE2eOrCiBypass()) {
        console.info("[BackofficeAdhesionService][syncEmail] E2E skip Supabase Auth update", {
          adhesionId: adhesion.id,
          newEmail,
        })
      } else {
        const supabaseAdmin = createSupabaseAdmin()
        if (!supabaseAdmin) {
          console.error("[BackofficeAdhesionService][syncEmail] Supabase Admin não configurado")
          return
        }
        try {
          const { error } = await supabaseAdmin.auth.admin.updateUserById(adhesion.createdSupabaseId, {
            email: newEmail.trim(),
            email_confirm: true,
          } as unknown as Record<string, unknown>)
          if (error) {
            console.error("[BackofficeAdhesionService][syncEmail][auth]", error)
            if (String(error.message ?? "").toLowerCase().includes("already exists") || (error as { status?: number }).status === 422) {
              throw new Error("Já existe uma conta cadastrada com este e-mail")
            }
            throw new Error(`Falha ao atualizar e-mail na autenticação: ${error.message}`)
          }
        } catch (e) {
          if (isE2eOrCiBypass()) {
            console.info("[BackofficeAdhesionService][syncEmail] E2E fallback após exceção Auth", {
              adhesionId: adhesion.id,
              error: String(e),
            })
          } else {
            throw e
          }
        }
      }
    }
  }

  private async syncAdhesionEmailArtifactsIfNeeded(
    adhesion: BackofficeAdhesionWithRelations
  ): Promise<void> {
    if (!adhesion.email) return

    const targetEmail = adhesion.email.trim()
    const normalizedTarget = targetEmail.toLowerCase()

    let needsSync = false
    let previousEmail: string | null = null

    if (adhesion.lead.email && adhesion.lead.email.trim().toLowerCase() !== normalizedTarget) {
      needsSync = true
      previousEmail = adhesion.lead.email
    }

    if (adhesion.createdProfileId) {
      try {
        const maybeRepo = this.repo as unknown as { findProfileEmailById?: (id: string) => Promise<string | null> }
        const profileEmail = maybeRepo.findProfileEmailById
          ? await maybeRepo.findProfileEmailById(adhesion.createdProfileId)
          : null
        if (profileEmail && profileEmail.trim().toLowerCase() !== normalizedTarget) {
          needsSync = true
          previousEmail = profileEmail
        }
      } catch (error) {
        console.error("[BackofficeAdhesionService][syncEmail][profile-fetch]", error)
      }
    }

    if (adhesion.createdSupabaseId) {
      const supabaseAdmin = createSupabaseAdmin()
      if (supabaseAdmin) {
        try {
          const { data, error } = await supabaseAdmin.auth.admin.getUserById(adhesion.createdSupabaseId)
          if (!error && data?.user?.email && data.user.email.trim().toLowerCase() !== normalizedTarget) {
            needsSync = true
            previousEmail = data.user.email
          }
        } catch (error) {
          console.error("[BackofficeAdhesionService][syncEmail][auth-fetch]", error)
        }
      }
    }

    if (needsSync) {
      await this.syncAdhesionEmailArtifacts(adhesion, targetEmail, previousEmail)
    }
  }
}

export const backofficeAdhesionService = new BackofficeAdhesionService()

function buildAdhesionInstallmentSchedule(input: {
  cardRule?: BackofficeProductPaymentRule
  cycleTotal: number
  maxInstallments: number
}): number[] {
  if (input.cardRule?.installmentSplitMode === "CUSTOM") {
    const schedule = Array.isArray(input.cardRule.installmentSchedule)
      ? (input.cardRule.installmentSchedule as number[])
      : []
    if (schedule.length > 0) {
      return scaleInstallmentScheduleToTotal(schedule, input.cycleTotal)
    }
  }
  const count = Math.max(1, Math.trunc(input.maxInstallments || 1))
  if (count === 1) return [Number(input.cycleTotal.toFixed(2))]
  const base = Number((input.cycleTotal / count).toFixed(2))
  const parts = Array.from({ length: count }, () => base)
  const drift = Number((input.cycleTotal - parts.reduce((sum, value) => sum + value, 0)).toFixed(2))
  parts[parts.length - 1] = Number((parts[parts.length - 1] + drift).toFixed(2))
  return parts
}
