import type { BackofficeAdhesionBillingCycle, BackofficeProduct, BackofficeProductPaymentRule } from "@prisma/client"
import { asaasApi, asaasFetch } from "@/lib/asaas"
import {
  BACKOFFICE_ADHESION_CYCLE_LABELS,
  BACKOFFICE_ADHESION_CYCLE_MONTHS,
  type BackofficeAdhesionPrices,
  calculateBackofficeAdhesionPricing,
  resolveProductPriceForCycle,
} from "@/lib/backoffice-adhesions/adhesion-pricing"
import {
  generateBackofficeAdhesionToken,
  getBackofficeAdhesionTokenPreview,
  hashBackofficeAdhesionToken,
  validateBackofficeAdhesionToken,
} from "@/lib/backoffice-adhesions/adhesion-token-validation"
import { addMonthsInTz, DEFAULT_TZ, formatIntimezone } from "@/lib/dates"
import { createEmailService } from "@/lib/email/create-email-service"
import { buildSetPasswordEmailAuthLink } from "@/lib/supabase/email-auth-link"
import { createSupabaseAdmin } from "@/lib/supabase/server"
import { getFullUrl } from "@/lib/utils/app-url"
import type {
  BackofficeAdhesionWithRelations,
  IBackofficeAdhesionRepository,
} from "@/app/api/infra/data/repositories/backoffice/backofficeAdhesion/IBackofficeAdhesionRepository"
import { BackofficeAdhesionRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeAdhesion/BackofficeAdhesionRepository"
import type { IBackofficeProductRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeProduct/IBackofficeProductRepository"
import { BackofficeProductRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeProduct/BackofficeProductRepository"
import type { IBackofficeUserSubscriptionRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeUserSubscription/IBackofficeUserSubscriptionRepository"
import { BackofficeUserSubscriptionRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeUserSubscription/BackofficeUserSubscriptionRepository"
import type { IBackofficeAllUsersRepository } from "@/app/api/infra/data/repositories/backoffice/AllUsersRepository/IBackofficeAllUsersRepository"
import { BackofficeAllUsersRepository } from "@/app/api/infra/data/repositories/backoffice/AllUsersRepository/BackofficeAllUsersRepository"
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
  }
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
      creditCardMonthlyTotalAmount = roundCurrency(Number(cardRule.price.toString()) + monthlyExtras)
      creditCardTotalAmount = roundCurrency(creditCardMonthlyTotalAmount * cycleMonths)
      maxCardInstallments = cardRule.maxInstallments
    }
  }

  const presetBillingType = adhesion.billingType === "PIX" ? "PIX" : "CREDIT_CARD"
  const resolvedMonthlyTotalAmount =
    presetBillingType === "PIX" ? pixMonthlyTotalAmount : creditCardMonthlyTotalAmount
  const resolvedTotalAmount = presetBillingType === "PIX" ? pixTotalAmount : creditCardTotalAmount
  const resolvedMaxInstallments =
    presetBillingType === "PIX" ? 1 : Math.max(1, Math.trunc(maxCardInstallments || 1))

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
    createdAt: adhesion.createdAt.toISOString(),
    paidAt: adhesion.paidAt?.toISOString() ?? null,
    expiresAt: adhesion.expiresAt.toISOString(),
  }
}

function mapPayment(adhesion: BackofficeAdhesionWithRelations): BackofficeAdhesionPaymentDTO {
  const payment: BackofficeAdhesionPaymentDTO = {
    adhesionId: adhesion.id,
    paymentId: adhesion.asaasPaymentId,
    status: adhesion.status,
    billingType: adhesion.billingType,
    amount: decimalToNumber(adhesion.totalAmount),
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
    private readonly allUsersRepo: IBackofficeAllUsersRepository = new BackofficeAllUsersRepository()
  ) {}

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
    const options = await this.repo.getOptions()
    const users = options.users.map((user) => ({
      id: user.id,
      name: user.profile.fullName ?? user.email,
      email: user.email || user.profile.email,
      isSdr: user.isSdr,
      isCloser: user.isCloser,
    }))

    const pricingCycles = await this.resolvePricingOptions()

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
      pricing: {
        cycles: pricingCycles,
      },
    }
  }

  async create(
    input: BackofficeAdhesionCreateInput,
    createdByBackofficeUserId: string | null
  ): Promise<BackofficeAdhesionCreationResult> {
    const normalized = this.normalizeCommercialInput(input)
    const crmWithRules = await this.productRepo.findBySlugWithPaymentRules(CRM_PRODUCT_SLUG)
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

    const prices = await this.resolvePrices(normalized.cycle)
    const pricing = calculateBackofficeAdhesionPricing(normalized, prices, crmWithRules.paymentRules)
    const resolvedBillingType = normalized.billingType ?? "PIX"
    const resolvedMonthlyTotalAmount =
      resolvedBillingType === "PIX" ? pricing.pixMonthlyTotalAmount : pricing.creditCardMonthlyTotalAmount
    const resolvedTotalAmount =
      resolvedBillingType === "PIX" ? pricing.pixTotalAmount : pricing.creditCardTotalAmount
    const token = generateBackofficeAdhesionToken()
    const adhesion = await this.repo.createAndMoveLeadToAdhesion({
      leadId: normalized.leadId,
      fullName: normalized.fullName,
      phone: normalized.phone ?? "",
      billingType: resolvedBillingType,
      plan: "crm",
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
      requestedUserTypeSlug: normalized.userType === "member_pro" ? "member_pro" : null,
      requestedMemberProAccessExpiresAt:
        normalized.userType === "member_pro" && normalized.accessExpiresAt
          ? new Date(normalized.accessExpiresAt)
          : null,
      additionalUsersData: normalized.additionalUsers ?? [],
      additionalTeamsData: normalized.additionalTeams ?? [],
    })

    if (normalized.activationMode === "external_paid") {
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
        const paidAdhesion = await this.repo.markExternalPaid(adhesion.id, {
          fullName: normalized.fullName,
          phone: normalized.phone ?? "",
          email: externalEmail,
          cpfCnpj: normalizedCpfCnpj,
          paidAt,
          asaasCustomerId,
        })
        await this.ensureAccountForPaidAdhesion(paidAdhesion)

        return {
          adhesion: mapAdhesion(paidAdhesion),
          publicUrl: null,
          expiresAt: paidAdhesion.expiresAt.toISOString(),
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
    })
    const prices = await this.resolvePrices(next.cycle)
    const crmWithRules = await this.productRepo.findBySlugWithPaymentRules(CRM_PRODUCT_SLUG)
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
    if (existing.status !== "paid") {
      throw new Error("Convite só pode ser reenviado para adesões pagas")
    }
    if (!existing.email) {
      throw new Error("Adesão paga sem e-mail para reenvio de convite")
    }

    if (!existing.createdSupabaseId && !existing.createdProfileId) {
      await this.ensureAccountForPaidAdhesion(existing)
      return { email: existing.email }
    }

    await this.sendSetPasswordEmail(existing, "recovery")
    return { email: existing.email }
  }

  async getPublicUrl(id: string): Promise<{ publicUrl: string; expiresAt: string }> {
    const existing = await this.repo.findById(id)
    if (!existing) {
      throw new Error("Adesão não encontrada")
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

    const crmProduct = await this.productRepo.findBySlugWithPaymentRules(CRM_PRODUCT_SLUG)
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

    if (adhesion.asaasPaymentId) {
      if (adhesion.status === "paid") {
        return mapPayment(adhesion)
      }

      const requestedBillingType = input.billingType ?? "PIX"
      const isSameBillingType = adhesion.billingType === requestedBillingType

      if (isSameBillingType && requestedBillingType === "PIX") {
        return mapPayment(adhesion)
      }

      try {
        await asaasFetch(`${asaasApi.payments}/${adhesion.asaasPaymentId}`, {
          method: "DELETE",
        })
      } catch (error) {
        console.error(
          "[BackofficeAdhesionService][createCheckout] Failed to cancel old Asaas payment:",
          error
        )
      }

      adhesion = await this.repo.clearPaymentArtifacts(adhesion.id)
    }

    const normalized = this.normalizeCheckoutInput(input, adhesion.cycle)
    const existingProfileId = await this.repo.findProfileIdByEmail(normalized.email)
    if (existingProfileId) {
      throw new Error("Já existe uma conta cadastrada com este e-mail")
    }

    const crmProduct = await this.productRepo.findBySlugWithPaymentRules(CRM_PRODUCT_SLUG)
    const paymentRules = crmProduct?.paymentRules ?? []
    const publicDetails = mapPublicAdhesion(adhesion, paymentRules)
    const chargeAmount =
      normalized.billingType === "PIX"
        ? publicDetails.pixTotalAmount
        : publicDetails.creditCardTotalAmount

    const customerId = await this.ensureAsaasCustomer(adhesion, normalized)
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

  async processPaymentWebhook(
    event: string,
    payment: BackofficeAdhesionPaymentWebhookInput
  ): Promise<{ processed: boolean; adhesionId?: string }> {
    if (!payment.id) {
      return { processed: false }
    }

    const adhesion =
      (await this.repo.findByAsaasPaymentId(payment.id)) ??
      (payment.externalReference?.startsWith("backoffice-adhesion-")
        ? await this.repo.findById(payment.externalReference.replace("backoffice-adhesion-", ""))
        : null)

    if (!adhesion) {
      console.info("[BackofficeAdhesionService][processPaymentWebhook] adesão não encontrada", {
        paymentId: payment.id,
        externalReference: payment.externalReference ?? null,
        event,
      })
      return { processed: false }
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
        await this.ensureAccountForPaidAdhesion(updated)
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

    if (activationMode === "external_paid") {
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
      cycle: input.cycle,
      extraTeams,
      extraUsers,
      sdrBackofficeUserId: normalizeText(input.sdrBackofficeUserId),
      closerBackofficeUserId: normalizeText(input.closerBackofficeUserId),
      activationMode,
      billingType,
      userType: input.userType ?? "common",
      accessExpiresAt: input.accessExpiresAt ?? null,
      additionalUsers: input.additionalUsers ?? [],
      additionalTeams: input.additionalTeams ?? [],
    }
  }

  private normalizeCheckoutInput(
    input: BackofficeAdhesionCheckoutInput,
    cycle: BackofficeAdhesionBillingCycle
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

    const maxInstallments = BACKOFFICE_ADHESION_CYCLE_MONTHS[cycle] ?? 1
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

  private async ensureAsaasCustomer(
    adhesion: BackofficeAdhesionWithRelations,
    input: BackofficeAdhesionCheckoutInput
  ): Promise<string> {
    if (adhesion.asaasCustomerId) {
      return adhesion.asaasCustomerId
    }

    const customer = await asaasFetch(asaasApi.customers, {
      method: "POST",
      body: JSON.stringify({
        name: input.fullName,
        email: input.email,
        cpfCnpj: input.cpfCnpj,
        mobilePhone: input.phone,
        postalCode: input.postalCode,
        address: input.address,
        addressNumber: input.addressNumber,
        complement: input.complement ?? undefined,
        province: input.neighborhood,
        externalReference: `backoffice-adhesion-${adhesion.id}`,
      }),
    })

    return String(customer.id)
  }

  private async createExternalAsaasCustomer(input: {
    adhesionId: string
    fullName: string
    email: string
    cpfCnpj: string
    phone: string
  }): Promise<string> {
    const customer = await asaasFetch(asaasApi.customers, {
      method: "POST",
      body: JSON.stringify({
        name: input.fullName,
        email: input.email,
        cpfCnpj: input.cpfCnpj,
        mobilePhone: input.phone,
        externalReference: `backoffice-adhesion-${input.adhesionId}`,
        observations: "Cliente criado via adesão com pagamento externo (sem fatura Asaas).",
      }),
    })

    const customerId = customer?.id
    if (!customerId) {
      throw new Error(
        `Asaas não retornou um ID válido para o cliente criado (adhesionId: ${input.adhesionId})`
      )
    }
    return String(customerId)
  }

  private async createAsaasPayment(
    adhesion: BackofficeAdhesionWithRelations,
    customerId: string,
    input: BackofficeAdhesionCheckoutInput,
    chargeAmount: number
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
      if ((input.installments ?? 1) > 1) {
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

    const payment = (await asaasFetch(`${asaasApi.payments}/${adhesion.asaasPaymentId}`, {
      method: "GET",
    })) as BackofficeAdhesionPaymentWebhookInput

    const status = payment.status?.toUpperCase() ?? ""
    if (status === "PENDING") {
      return adhesion
    }

    await this.processPaymentWebhook(mapSyncedPaymentEvent(payment), payment)

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
    adhesion: BackofficeAdhesionWithRelations
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

    try {
      const cycleMonths = BACKOFFICE_ADHESION_CYCLE_MONTHS[adhesion.cycle] ?? 1
      const subscriptionStartDate = adhesion.paidAt ?? new Date()
      const subscriptionEndDate = addMonthsInTz(subscriptionStartDate, cycleMonths, DEFAULT_TZ)

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
      })

      await this.repo.activateCreatedProfileSubscription(createdProfile.profileId, {
        subscriptionEndDate,
        subscriptionCycle: adhesion.cycle,
        subscriptionNextDueDate: subscriptionEndDate,
        canCreateAccountUsers: true,
        canManageAccountTeams: true,
      })

      await this.repo.markAccountCreated(adhesion.id, {
        createdProfileId: createdProfile.profileId,
        createdSupabaseId: createdProfile.supabaseId,
      })

      if (adhesion.requestedUserTypeSlug === "member_pro" && adhesion.requestedMemberProAccessExpiresAt) {
        await this.allUsersRepo.upsertUserTypeAssignment(createdProfile.profileId, {
          userType: "member_pro",
          accessExpiresAt: adhesion.requestedMemberProAccessExpiresAt,
          assignedByProfileId: null,
        })
      }

      await this.ensureUserSubscriptionForPaidAdhesion(adhesion, createdProfile.profileId)

      const crmProduct = await this.getActiveProductBySlug(CRM_PRODUCT_SLUG)
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

      await this.sendSetPasswordEmail(adhesion, "invite", linkData)
    } catch (accountError) {
      await supabaseAdmin.auth.admin.deleteUser(supabaseId).catch((deleteError) => {
        console.error("[BackofficeAdhesionService][ensureAccountForPaidAdhesion][rollback]", deleteError)
      })
      throw accountError
    }
  }

  private async resolvePricingOptions(): Promise<
    BackofficeAdhesionOptionsDTO["pricing"]["cycles"]
  > {
    const [crmWithRules, extraTeamProduct, extraUserProduct] = await Promise.all([
      this.productRepo.findBySlugWithPaymentRules(CRM_PRODUCT_SLUG),
      this.getActiveProductBySlug(EXTRA_TEAM_PRODUCT_SLUG),
      this.getActiveProductBySlug(EXTRA_USER_PRODUCT_SLUG),
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
        cardBaseMonthlyPrice: cardRule ? Number(cardRule.price.toString()) : null,
      }] as const
    })

    return Object.fromEntries(entries) as BackofficeAdhesionOptionsDTO["pricing"]["cycles"]
  }

  private async resolvePrices(
    cycle: BackofficeAdhesionBillingCycle
  ): Promise<BackofficeAdhesionPrices> {
    const [crmProduct, extraTeamProduct, extraUserProduct] = await Promise.all([
      this.getActiveProductBySlug(CRM_PRODUCT_SLUG),
      this.getActiveProductBySlug(EXTRA_TEAM_PRODUCT_SLUG),
      this.getActiveProductBySlug(EXTRA_USER_PRODUCT_SLUG),
    ])

    return {
      baseMonthlyPrice: resolveProductPriceForCycle(crmProduct, cycle),
      extraTeamPrice: resolveProductPriceForCycle(extraTeamProduct, cycle),
      extraUserPrice: resolveProductPriceForCycle(extraUserProduct, cycle),
    }
  }

  private async getActiveProductBySlug(slug: string): Promise<BackofficeProduct> {
    const product = await this.productRepo.findBySlug(slug)
    if (!product || !product.isActive) {
      throw new Error(`Produto obrigatório indisponível: ${slug}`)
    }
    return product
  }

  private async ensureUserSubscriptionForPaidAdhesion(
    adhesion: BackofficeAdhesionWithRelations,
    profileId: string
  ): Promise<void> {
    const crmProduct = await this.getActiveProductBySlug(CRM_PRODUCT_SLUG)
    const startDate = adhesion.paidAt ?? new Date()
    const cycleMonths = BACKOFFICE_ADHESION_CYCLE_MONTHS[adhesion.cycle] ?? 1
    const endDate = addMonthsInTz(startDate, cycleMonths, DEFAULT_TZ)

    await this.userSubscriptionRepo.upsertForAdhesion({
      profileId,
      productId: crmProduct.id,
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
        throw new Error("Supabase Admin não configurado")
      }

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
        throw new Error("Erro ao gerar link de convite")
      }

      linkData = data
    }

    const emailService = createEmailService()
    await emailService.sendAdhesionCompletedEmail({
      userName: adhesion.fullName,
      userEmail: adhesion.email,
      setPasswordUrl: buildSetPasswordEmailAuthLink(linkData, type),
    })
  }
}

export const backofficeAdhesionService = new BackofficeAdhesionService()
