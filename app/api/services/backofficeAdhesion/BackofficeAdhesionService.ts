import type { BackofficeAdhesionBillingCycle } from "@prisma/client"
import { asaasApi, asaasFetch } from "@/lib/asaas"
import {
  BACKOFFICE_ADHESION_CYCLE_LABELS,
  calculateBackofficeAdhesionPricing,
} from "@/lib/backoffice-adhesions/adhesion-pricing"
import {
  generateBackofficeAdhesionToken,
  getBackofficeAdhesionTokenPreview,
  hashBackofficeAdhesionToken,
  validateBackofficeAdhesionToken,
} from "@/lib/backoffice-adhesions/adhesion-token-validation"
import { addMonthsInTz, DEFAULT_TZ, formatInTz } from "@/lib/dates"
import { createEmailService } from "@/lib/email/create-email-service"
import { createSupabaseAdmin } from "@/lib/supabase/server"
import { getFullUrl } from "@/lib/utils/app-url"
import type {
  BackofficeAdhesionWithRelations,
  IBackofficeAdhesionRepository,
} from "@/app/api/infra/data/repositories/backoffice/backofficeAdhesion/IBackofficeAdhesionRepository"
import { BackofficeAdhesionRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeAdhesion/BackofficeAdhesionRepository"
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
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000
const PAID_ASAAS_STATUSES = new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH", "APPROVED"])
const OVERDUE_ASAAS_STATUSES = new Set(["OVERDUE"])
const CANCELED_ASAAS_STATUSES = new Set(["REFUNDED", "CANCELED", "CANCELLED", "CHARGEBACK"])

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

function mapAdhesion(adhesion: BackofficeAdhesionWithRelations): BackofficeAdhesionDTO {
  return {
    id: adhesion.id,
    leadId: adhesion.leadId,
    leadName: adhesion.lead.name,
    fullName: adhesion.fullName,
    phone: adhesion.phone,
    email: adhesion.email,
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
  adhesion: BackofficeAdhesionWithRelations
): BackofficeAdhesionPublicDTO {
  const pricing = calculateBackofficeAdhesionPricing({
    cycle: adhesion.cycle,
    extraTeams: adhesion.extraTeams,
    extraUsers: adhesion.extraUsers,
  })

  return {
    id: adhesion.id,
    fullName: adhesion.fullName,
    phone: adhesion.phone,
    email: adhesion.email,
    status: adhesion.status,
    cycle: adhesion.cycle,
    cycleLabel: BACKOFFICE_ADHESION_CYCLE_LABELS[adhesion.cycle],
    cycleMonths: pricing.cycleMonths,
    modules: adhesion.modules,
    extraTeams: adhesion.extraTeams,
    extraUsers: adhesion.extraUsers,
    monthlyTotalAmount: decimalToNumber(adhesion.monthlyTotalAmount),
    totalAmount: decimalToNumber(adhesion.totalAmount),
    maxInstallments: pricing.maxInstallments,
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

export class BackofficeAdhesionService implements IBackofficeAdhesionService {
  constructor(private readonly repo: IBackofficeAdhesionRepository = new BackofficeAdhesionRepository()) {}

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

    return {
      leads: options.leads.map((lead) => ({
        id: lead.id,
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
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
    }
  }

  async create(
    input: BackofficeAdhesionCreateInput,
    createdByBackofficeUserId: string | null
  ): Promise<BackofficeAdhesionCreationResult> {
    const normalized = this.normalizeCommercialInput(input)
    const options = await this.repo.getOptions()
    const lead = options.leads.find((item) => item.id === normalized.leadId)

    if (!lead) {
      throw new Error("Lead não está elegível para nova adesão")
    }

    const existing = await this.repo.findByLeadId(normalized.leadId)
    if (existing) {
      throw new Error("Lead já possui uma adesão vinculada")
    }

    const pricing = calculateBackofficeAdhesionPricing(normalized)
    const token = generateBackofficeAdhesionToken()
    const adhesion = await this.repo.createAndMoveLeadToAdhesion({
      leadId: normalized.leadId,
      fullName: normalized.fullName,
      phone: normalized.phone,
      plan: "crm",
      cycle: normalized.cycle,
      modules: CRM_MODULES,
      extraTeams: normalized.extraTeams,
      extraUsers: normalized.extraUsers,
      ...pricing,
      tokenHash: hashBackofficeAdhesionToken(token),
      tokenPreview: getBackofficeAdhesionTokenPreview(token),
      expiresAt: addTokenTtl(),
      sdrBackofficeUserId: normalized.sdrBackofficeUserId ?? lead.sdrBackofficeUserId,
      closerBackofficeUserId:
        normalized.closerBackofficeUserId ?? lead.closerBackofficeUserId,
      createdByBackofficeUserId,
    })

    return {
      adhesion: mapAdhesion(adhesion),
      publicUrl: getPublicUrl(token),
      expiresAt: adhesion.expiresAt.toISOString(),
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

    const next = this.normalizeCommercialInput({
      leadId: existing.leadId,
      fullName: input.fullName ?? existing.fullName,
      phone: input.phone ?? existing.phone,
      cycle: input.cycle ?? existing.cycle,
      extraTeams: input.extraTeams ?? existing.extraTeams,
      extraUsers: input.extraUsers ?? existing.extraUsers,
      sdrBackofficeUserId:
        input.sdrBackofficeUserId !== undefined
          ? input.sdrBackofficeUserId
          : existing.sdrBackofficeUserId,
      closerBackofficeUserId:
        input.closerBackofficeUserId !== undefined
          ? input.closerBackofficeUserId
          : existing.closerBackofficeUserId,
    })
    const pricing = calculateBackofficeAdhesionPricing(next)
    const updated = await this.repo.update(id, {
      fullName: next.fullName,
      phone: next.phone,
      cycle: next.cycle,
      modules: CRM_MODULES,
      extraTeams: next.extraTeams,
      extraUsers: next.extraUsers,
      ...pricing,
      sdrBackofficeUserId: next.sdrBackofficeUserId,
      closerBackofficeUserId: next.closerBackofficeUserId,
    })

    return mapAdhesion(updated)
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
      expiresAt: addTokenTtl(),
    })

    return {
      adhesion: mapAdhesion(updated),
      publicUrl: getPublicUrl(token),
      expiresAt: updated.expiresAt.toISOString(),
    }
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

    return mapPublicAdhesion(adhesion)
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

    const adhesion = await this.repo.findById(validation.adhesionId)
    if (!adhesion) {
      return tokenError("not_found")
    }

    if (adhesion.asaasPaymentId) {
      return mapPayment(adhesion)
    }

    const normalized = this.normalizeCheckoutInput(input, adhesion.cycle)
    const existingProfileId = await this.repo.findProfileIdByEmail(normalized.email)
    if (existingProfileId) {
      throw new Error("Já existe uma conta cadastrada com este e-mail")
    }

    const customerId = await this.ensureAsaasCustomer(adhesion, normalized)
    const paymentResult = await this.createAsaasPayment(adhesion, customerId, normalized)
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

  async getPaymentStatus(token: string): Promise<BackofficeAdhesionPaymentDTO | BackofficeAdhesionTokenError> {
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

    const adhesion = await this.repo.findById(validation.adhesionId)
    if (!adhesion) {
      return tokenError("not_found")
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
      event === "PAYMENT_DELETED"

    if (isPaid) {
      const paidAt = this.resolvePaymentDate(payment) ?? new Date()
      const updated = await this.repo.updateStatus(adhesion.id, "paid", { paidAt })
      await this.ensureAccountForPaidAdhesion(updated)
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

  private normalizeCommercialInput(
    input: BackofficeAdhesionCreateInput & { leadId: string }
  ): BackofficeAdhesionCreateInput {
    const fullName = normalizeText(input.fullName)
    if (!fullName || fullName.length < 2) {
      throw new Error("Nome completo deve ter pelo menos 2 caracteres")
    }

    const phone = normalizeDigits(input.phone, 11)
    if (!/^\d{10,11}$/.test(phone)) {
      throw new Error("Celular deve conter 10 ou 11 dígitos")
    }

    const extraTeams = Math.max(0, Math.trunc(input.extraTeams || 0))
    const extraUsers = Math.max(0, Math.trunc(input.extraUsers || 0))

    return {
      leadId: input.leadId,
      fullName,
      phone,
      cycle: input.cycle,
      extraTeams,
      extraUsers,
      sdrBackofficeUserId: normalizeText(input.sdrBackofficeUserId),
      closerBackofficeUserId: normalizeText(input.closerBackofficeUserId),
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

    const maxInstallments = calculateBackofficeAdhesionPricing({
      cycle,
      extraTeams: 0,
      extraUsers: 0,
    }).maxInstallments
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

  private async createAsaasPayment(
    adhesion: BackofficeAdhesionWithRelations,
    customerId: string,
    input: BackofficeAdhesionCheckoutInput
  ): Promise<{
    paymentId: string
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
    const dueDate = formatInTz(new Date(), "yyyy-MM-dd", ownerTz)
    const totalAmount = decimalToNumber(adhesion.totalAmount)
    const payload: Record<string, unknown> = {
      customer: customerId,
      billingType: input.billingType,
      value: totalAmount,
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
      payload.installmentCount = input.installments
      payload.installmentValue = roundCurrency(totalAmount / Math.max(input.installments ?? 1, 1))
    }

    const payment = await asaasFetch(asaasApi.payments, {
      method: "POST",
      body: JSON.stringify(payload),
    })

    const result = {
      paymentId: String(payment.id),
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

    if (input.billingType === "BOLETO") {
      const boleto = await asaasFetch(`${asaasApi.payments}/${result.paymentId}/identificationField`, {
        method: "GET",
      })
      result.boleto = {
        bankSlipUrl: result.bankSlipUrl || result.invoiceUrl,
        identificationField: String(boleto.identificationField ?? ""),
        barCode: String(boleto.barCode ?? ""),
        dueDate: payment.dueDate ? String(payment.dueDate) : null,
      }
    }

    return result
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
      return
    }
    if (!adhesion.email || !adhesion.cpfCnpj) {
      throw new Error("Adesão paga sem dados suficientes para criar conta")
    }

    const supabaseAdmin = createSupabaseAdmin()
    if (!supabaseAdmin) {
      throw new Error("Supabase Admin não configurado")
    }

    const redirectTo = getFullUrl("/set-password")
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
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

    if (error || !data?.properties?.action_link) {
      throw new Error("Erro ao criar convite de acesso")
    }

    const supabaseId = data.user?.id
    if (!supabaseId) {
      throw new Error("Supabase não retornou o usuário criado")
    }

    try {
      const cycleMonths = calculateBackofficeAdhesionPricing({
        cycle: adhesion.cycle,
        extraTeams: adhesion.extraTeams,
        extraUsers: adhesion.extraUsers,
      }).cycleMonths
      const subscriptionStartDate = adhesion.paidAt ?? new Date()
      const subscriptionEndDate = addMonthsInTz(subscriptionStartDate, cycleMonths, DEFAULT_TZ)

      const createdProfile = await this.repo.createPaidManagerProfile({
        supabaseId,
        fullName: adhesion.fullName,
        phone: adhesion.phone,
        email: adhesion.email,
        asaasCustomerId: adhesion.asaasCustomerId,
        subscriptionId: `backoffice-adhesion-${adhesion.id}`,
        cpfCnpj: adhesion.cpfCnpj,
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

      const emailService = createEmailService()
      await emailService.sendOperatorInviteEmail({
        operatorName: adhesion.fullName,
        operatorEmail: adhesion.email,
        operatorRole: "manager",
        managerName: "Corretor Studio",
        inviteUrl: data.properties.action_link,
      })
    } catch (accountError) {
      await supabaseAdmin.auth.admin.deleteUser(supabaseId).catch((deleteError) => {
        console.error("[BackofficeAdhesionService][ensureAccountForPaidAdhesion][rollback]", deleteError)
      })
      throw accountError
    }
  }
}

export const backofficeAdhesionService = new BackofficeAdhesionService()
