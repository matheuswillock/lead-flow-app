import { Prisma } from "@prisma/client"
import { Output } from "@/lib/output"
import { prisma } from "@/app/api/infra/data/prisma"
import { assertResend } from "@/lib/email"
import {
  isTrackingSubdomainAlreadyExists,
  mapResendDomainError,
} from "@/lib/email/map-resend-domain-error"
import {
  assertSenderEmailIsAllowed,
  buildDeliveryFromEmail,
  isPlatformDefaultFromEmail,
  PLATFORM_FROM_EMAIL,
  PLATFORM_FROM_NAME,
  resolveCampaignFrom,
} from "@/lib/email/resolve-campaign-from"
import {
  emailTeamDomainEventRepository,
} from "@/app/api/infra/data/repositories/emailTeamDomainEvent/EmailTeamDomainEventRepository"
import {
  getResendDomainDispatchWarnings,
  isResendDomainTrackingCapable,
  resendDomainTrackingInputFromSettings,
} from "@/lib/email/campaign-dispatch-guards"
import type { TeamAccess as TeamContext } from "@/app/api/v1/utils/teamAccess"

export type BlockedDateRange =
  | { date: string }
  | { from: string; to: string }

export type ResendDomainStatus =
  | "not_started"
  | "pending"
  | "verified"
  | "failed"
  | "temporary_failure"
  | "partially_verified"
  | "partially_failed"

export interface UpdateEmailSettingsInput {
  dispatchBlockedDates?: BlockedDateRange[] | null
  dispatchTimeFrom?: string | null
  dispatchTimeTo?: string | null
  dispatchAllowedRoles?: string[]
  templateCreateRoles?: string[]
  templateApprovalRequired?: boolean
  templateApprovalRoles?: string[]
  blockedDispatchDays?: number[] | null
}

export interface UpsertEmailSenderInput {
  name: string
  email: string
  replyTo?: string | null
}

const VALID_ROLES = ["manager", "backoffice", "operator"] as const
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/
const senderSelect = {
  id: true,
  name: true,
  email: true,
  replyTo: true,
  isDefault: true,
} satisfies Prisma.EmailTeamSenderSelect

const DEFAULT_DOMAIN_REGION = "sa-east-1"
const DEFAULT_TRACKING_SUBDOMAIN = "links"

export type ConfigureDomainTrackingInput = {
  trackingSubdomain: string
  openTracking: boolean
  clickTracking: boolean
}

const TRACKING_SUBDOMAIN_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/

function normalizeTrackingSubdomain(value: string): string | null {
  const normalized = value.trim().toLowerCase()
  if (!TRACKING_SUBDOMAIN_RE.test(normalized)) return null
  return normalized
}

const CLEAR_DOMAIN_DATA = {
  resendDomainId: null,
  resendDomainName: null,
  resendDomainStatus: null,
  resendDomainRegion: null,
  resendDomainConnectedAt: null,
  resendOpenTracking: false,
  resendClickTracking: false,
} as const

const DEFAULTS = {
  fromName: PLATFORM_FROM_NAME,
  fromEmail: PLATFORM_FROM_EMAIL,
  replyTo: null,
  dispatchBlockedDates: null,
  dispatchTimeFrom: null,
  dispatchTimeTo: null,
  dispatchAllowedRoles: ["manager", "backoffice"],
  templateCreateRoles: ["manager", "backoffice"],
  templateApprovalRequired: false,
  templateApprovalRoles: ["manager", "backoffice"],
  blockedDispatchDays: [],
  resendDomainId: null,
  resendDomainName: null,
  resendDomainStatus: null,
  resendDomainRegion: null,
  resendDomainConnectedAt: null,
  resendOpenTracking: false,
  resendClickTracking: false,
}

function validateRoles(roles: string[]): string | null {
  const invalid = roles.filter((r) => !VALID_ROLES.includes(r as (typeof VALID_ROLES)[number]))
  if (invalid.length > 0) return `Roles inválidas: ${invalid.join(", ")}`
  return null
}

function validateBlockedDates(entries: BlockedDateRange[]): string | null {
  for (const entry of entries) {
    if ("date" in entry) {
      if (!DATE_RE.test(entry.date)) return `Data inválida: ${entry.date}. Use o formato YYYY-MM-DD`
    } else {
      if (!DATE_RE.test(entry.from)) return `Data inválida: ${entry.from}. Use o formato YYYY-MM-DD`
      if (!DATE_RE.test(entry.to)) return `Data inválida: ${entry.to}. Use o formato YYYY-MM-DD`
      if (entry.from > entry.to) return "Intervalo inválido: 'from' deve ser anterior a 'to'"
    }
  }
  return null
}

function validateBlockedDays(days: number[]): string | null {
  const invalid = days.filter((day) => !Number.isInteger(day) || day < 1 || day > 31)
  if (invalid.length > 0) return `Dias bloqueados inválidos: ${invalid.join(", ")}`
  return null
}

function validateSenderInput(input: UpsertEmailSenderInput): string | null {
  if (!input.name.trim()) return "Nome do remetente não pode ser vazio"
  if (!input.email.trim()) return "Email do remetente não pode ser vazio"
  return null
}

function validateSenderEmailForDomain(
  email: string,
  domainName: string | null | undefined,
  domainStatus: string | null | undefined
): string | null {
  const check = assertSenderEmailIsAllowed({ email, domainName, domainStatus })
  return check.ok ? null : check.message
}

function normalizeSenderPayload(input: UpsertEmailSenderInput) {
  return {
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    replyTo: input.replyTo?.trim() ? input.replyTo.trim().toLowerCase() : null,
  }
}

export class EmailTeamSettingsUseCase {
  private async getSettingsRecord(tx: Prisma.TransactionClient, teamId: string) {
    return tx.emailTeamSettings.findUnique({
      where: { teamId },
    })
  }

  private async getSenders(tx: Prisma.TransactionClient, teamId: string) {
    return tx.emailTeamSender.findMany({
      where: { teamId },
      select: senderSelect,
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }, { name: "asc" }],
    })
  }

  private async getVariables(tx: Prisma.TransactionClient, teamId: string) {
    return tx.emailTeamVariable.findMany({
      where: { teamId },
      select: { id: true, key: true, type: true, defaultValue: true, description: true, isActive: true },
      orderBy: [{ key: "asc" }],
    })
  }

  private composeResult(
    settings: Awaited<ReturnType<EmailTeamSettingsUseCase["getSettingsRecord"]>>,
    senders: Awaited<ReturnType<EmailTeamSettingsUseCase["getSenders"]>>,
    globalVariables: Awaited<ReturnType<EmailTeamSettingsUseCase["getVariables"]>> = [],
    domainEvents: Array<{
      id: string
      type: string
      occurredAt: string
      metadata: Record<string, unknown> | null
    }> = []
  ) {
    const defaultSender = senders.find((sender) => sender.isDefault) ?? null
    const resolvedFrom = resolveCampaignFrom({
      domainName: settings?.resendDomainName,
      defaultSender: defaultSender
        ? { name: defaultSender.name, email: defaultSender.email }
        : null,
      legacyFromName: settings?.fromName,
      legacyFromEmail: settings?.fromEmail,
    })

    return {
      fromName: resolvedFrom.fromName,
      fromEmail: resolvedFrom.fromEmail,
      replyTo: settings?.replyTo ?? DEFAULTS.replyTo,
      dispatchBlockedDates:
        settings?.dispatchBlockedDates === null || settings?.dispatchBlockedDates === undefined
          ? DEFAULTS.dispatchBlockedDates
          : (settings.dispatchBlockedDates as BlockedDateRange[]),
      dispatchTimeFrom: settings?.dispatchTimeFrom ?? DEFAULTS.dispatchTimeFrom,
      dispatchTimeTo: settings?.dispatchTimeTo ?? DEFAULTS.dispatchTimeTo,
      dispatchAllowedRoles: settings?.dispatchAllowedRoles ?? DEFAULTS.dispatchAllowedRoles,
      templateCreateRoles: settings?.templateCreateRoles ?? DEFAULTS.templateCreateRoles,
      templateApprovalRequired: settings?.templateApprovalRequired ?? DEFAULTS.templateApprovalRequired,
      templateApprovalRoles: settings?.templateApprovalRoles ?? DEFAULTS.templateApprovalRoles,
      blockedDispatchDays: settings?.blockedDispatchDays ?? DEFAULTS.blockedDispatchDays,
      resendDomainId: settings?.resendDomainId ?? DEFAULTS.resendDomainId,
      resendDomainName: settings?.resendDomainName ?? DEFAULTS.resendDomainName,
      resendDomainStatus: settings?.resendDomainStatus ?? DEFAULTS.resendDomainStatus,
      resendDomainRegion: settings?.resendDomainRegion ?? DEFAULTS.resendDomainRegion,
      resendDomainConnectedAt: settings?.resendDomainConnectedAt?.toISOString() ?? null,
      resendOpenTracking: settings?.resendOpenTracking ?? DEFAULTS.resendOpenTracking,
      resendClickTracking: settings?.resendClickTracking ?? DEFAULTS.resendClickTracking,
      resendDomainTrackingCapable: isResendDomainTrackingCapable(settings?.resendDomainStatus),
      resendDomainDispatchWarnings: getResendDomainDispatchWarnings(
        resendDomainTrackingInputFromSettings(settings)
      ),
      domainEvents,
      senders,
      defaultSenderId: defaultSender?.id ?? null,
      globalVariables,
    }
  }

  private async syncLegacySenderFields(
    tx: Prisma.TransactionClient,
    teamId: string,
    sender: { name: string; email: string; replyTo: string | null } | null,
    domainName?: string | null
  ) {
    const resolvedDomain =
      domainName ??
      (
        await tx.emailTeamSettings.findUnique({
          where: { teamId },
          select: { resendDomainName: true },
        })
      )?.resendDomainName

    const resolvedFrom = resolveCampaignFrom({
      domainName: resolvedDomain,
      defaultSender: sender,
    })

    await tx.emailTeamSettings.upsert({
      where: { teamId },
      create: {
        teamId,
        fromName: resolvedFrom.fromName,
        fromEmail: resolvedFrom.fromEmail,
        replyTo: sender?.replyTo ?? DEFAULTS.replyTo,
        dispatchAllowedRoles: DEFAULTS.dispatchAllowedRoles,
        templateCreateRoles: DEFAULTS.templateCreateRoles,
        templateApprovalRequired: DEFAULTS.templateApprovalRequired,
        templateApprovalRoles: DEFAULTS.templateApprovalRoles,
        blockedDispatchDays: DEFAULTS.blockedDispatchDays,
      },
      update: {
        fromName: resolvedFrom.fromName,
        fromEmail: resolvedFrom.fromEmail,
        replyTo: sender?.replyTo ?? DEFAULTS.replyTo,
      },
    })
  }

  private async ensureSingleDefaultSender(tx: Prisma.TransactionClient, teamId: string) {
    const senders = await this.getSenders(tx, teamId)
    if (senders.length === 0) {
      await this.syncLegacySenderFields(tx, teamId, null)
      return
    }

    const defaultSender = senders.find((sender) => sender.isDefault) ?? senders[0]

    await tx.emailTeamSender.updateMany({
      where: { teamId, id: { not: defaultSender.id }, isDefault: true },
      data: { isDefault: false },
    })

    if (!defaultSender.isDefault) {
      await tx.emailTeamSender.update({
        where: { id: defaultSender.id },
        data: { isDefault: true },
      })
    }

    await this.syncLegacySenderFields(tx, teamId, {
      name: defaultSender.name,
      email: defaultSender.email,
      replyTo: defaultSender.replyTo,
    })
  }

  async get(ctx: TeamContext): Promise<Output> {
    try {
      const rawEvents = await emailTeamDomainEventRepository.listEvents(ctx.teamId)
      const domainEvents = rawEvents.map((event) => ({
        id: event.id,
        type: event.type,
        occurredAt: event.occurredAt.toISOString(),
        metadata: event.metadata,
      }))
      const result = await prisma.$transaction(async (tx) => {
        const settings = await this.getSettingsRecord(tx, ctx.teamId)
        const senders = await this.getSenders(tx, ctx.teamId)
        const variables = await this.getVariables(tx, ctx.teamId)
        return this.composeResult(settings, senders, variables, domainEvents)
      })

      return new Output(true, [], [], result)
    } catch (error) {
      console.error("[EmailTeamSettingsUseCase][get]", error)
      return new Output(false, [], ["Erro ao buscar configurações de email"], null)
    }
  }

  async update(data: UpdateEmailSettingsInput, ctx: TeamContext): Promise<Output> {
    try {
      if (data.dispatchTimeFrom !== undefined && data.dispatchTimeFrom !== null && !TIME_RE.test(data.dispatchTimeFrom)) {
        return new Output(false, [], ["Horário de início inválido. Use o formato HH:mm"], null)
      }
      if (data.dispatchTimeTo !== undefined && data.dispatchTimeTo !== null && !TIME_RE.test(data.dispatchTimeTo)) {
        return new Output(false, [], ["Horário de fim inválido. Use o formato HH:mm"], null)
      }
      if (data.dispatchAllowedRoles !== undefined) {
        const err = validateRoles(data.dispatchAllowedRoles)
        if (err) return new Output(false, [], [err], null)
        if (data.dispatchAllowedRoles.length === 0) {
          return new Output(false, [], ["Pelo menos uma role deve ter permissão de disparo"], null)
        }
      }
      if (data.templateCreateRoles !== undefined) {
        const err = validateRoles(data.templateCreateRoles)
        if (err) return new Output(false, [], [err], null)
        if (data.templateCreateRoles.length === 0) {
          return new Output(false, [], ["Pelo menos uma role deve ter permissão de criar templates"], null)
        }
      }
      if (data.templateApprovalRoles !== undefined) {
        const err = validateRoles(data.templateApprovalRoles)
        if (err) return new Output(false, [], [err], null)
      }
      if (data.dispatchBlockedDates !== undefined && data.dispatchBlockedDates !== null) {
        const err = validateBlockedDates(data.dispatchBlockedDates)
        if (err) return new Output(false, [], [err], null)
      }
      if (data.blockedDispatchDays !== undefined && data.blockedDispatchDays !== null) {
        const err = validateBlockedDays(data.blockedDispatchDays)
        if (err) return new Output(false, [], [err], null)
      }
      if (data.templateApprovalRequired && data.templateApprovalRoles !== undefined && data.templateApprovalRoles.length === 0) {
        return new Output(false, [], ["Pelo menos uma role deve aprovar templates"], null)
      }

      const result = await prisma.$transaction(async (tx) => {
        const existing = await this.getSettingsRecord(tx, ctx.teamId)

        await tx.emailTeamSettings.upsert({
          where: { teamId: ctx.teamId },
          create: {
            teamId: ctx.teamId,
            fromName: existing?.fromName ?? DEFAULTS.fromName,
            fromEmail: existing?.fromEmail ?? DEFAULTS.fromEmail,
            replyTo: existing?.replyTo ?? DEFAULTS.replyTo,
            dispatchBlockedDates:
              data.dispatchBlockedDates === undefined || data.dispatchBlockedDates === null
                ? Prisma.JsonNull
                : data.dispatchBlockedDates,
            dispatchTimeFrom: data.dispatchTimeFrom ?? DEFAULTS.dispatchTimeFrom,
            dispatchTimeTo: data.dispatchTimeTo ?? DEFAULTS.dispatchTimeTo,
            dispatchAllowedRoles: data.dispatchAllowedRoles ?? DEFAULTS.dispatchAllowedRoles,
            templateCreateRoles: data.templateCreateRoles ?? DEFAULTS.templateCreateRoles,
            templateApprovalRequired: data.templateApprovalRequired ?? DEFAULTS.templateApprovalRequired,
            templateApprovalRoles: data.templateApprovalRoles ?? DEFAULTS.templateApprovalRoles,
            blockedDispatchDays: data.blockedDispatchDays ?? DEFAULTS.blockedDispatchDays,
            resendDomainId: existing?.resendDomainId ?? DEFAULTS.resendDomainId,
            resendDomainName: existing?.resendDomainName ?? DEFAULTS.resendDomainName,
            resendDomainStatus: existing?.resendDomainStatus ?? DEFAULTS.resendDomainStatus,
          },
          update: {
            ...(data.dispatchBlockedDates !== undefined && {
              dispatchBlockedDates: data.dispatchBlockedDates === null ? Prisma.DbNull : data.dispatchBlockedDates,
            }),
            ...(data.dispatchTimeFrom !== undefined && { dispatchTimeFrom: data.dispatchTimeFrom }),
            ...(data.dispatchTimeTo !== undefined && { dispatchTimeTo: data.dispatchTimeTo }),
            ...(data.dispatchAllowedRoles !== undefined && { dispatchAllowedRoles: data.dispatchAllowedRoles }),
            ...(data.templateCreateRoles !== undefined && { templateCreateRoles: data.templateCreateRoles }),
            ...(data.templateApprovalRequired !== undefined && { templateApprovalRequired: data.templateApprovalRequired }),
            ...(data.templateApprovalRoles !== undefined && { templateApprovalRoles: data.templateApprovalRoles }),
            ...(data.blockedDispatchDays !== undefined && {
              blockedDispatchDays: data.blockedDispatchDays ?? [],
            }),
          },
        })

        const settings = await this.getSettingsRecord(tx, ctx.teamId)
        const senders = await this.getSenders(tx, ctx.teamId)
        const variables = await this.getVariables(tx, ctx.teamId)
        return this.composeResult(settings, senders, variables)
      })

      return new Output(true, ["Configurações salvas com sucesso"], [], result)
    } catch (error) {
      console.error("[EmailTeamSettingsUseCase][update]", error)
      return new Output(false, [], ["Erro ao salvar configurações de email"], null)
    }
  }

  async listSenders(ctx: TeamContext): Promise<Output> {
    try {
      const senders = await prisma.emailTeamSender.findMany({
        where: { teamId: ctx.teamId },
        select: senderSelect,
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }, { name: "asc" }],
      })
      return new Output(true, [], [], senders)
    } catch (error) {
      console.error("[EmailTeamSettingsUseCase][listSenders]", error)
      return new Output(false, [], ["Erro ao buscar remetentes"], null)
    }
  }

  async createSender(input: UpsertEmailSenderInput, ctx: TeamContext): Promise<Output> {
    try {
      const validationError = validateSenderInput(input)
      if (validationError) return new Output(false, [], [validationError], null)

      const settings = await prisma.emailTeamSettings.findUnique({
        where: { teamId: ctx.teamId },
        select: { resendDomainName: true, resendDomainStatus: true },
      })
      const domainError = validateSenderEmailForDomain(
        input.email,
        settings?.resendDomainName,
        settings?.resendDomainStatus
      )
      if (domainError) return new Output(false, [], [domainError], null)

      const sender = await prisma.$transaction(async (tx) => {
        const payload = normalizeSenderPayload(input)
        const senderCount = await tx.emailTeamSender.count({ where: { teamId: ctx.teamId } })
        const created = await tx.emailTeamSender.create({
          data: {
            teamId: ctx.teamId,
            ...payload,
            isDefault: senderCount === 0,
          },
          select: senderSelect,
        })

        await this.ensureSingleDefaultSender(tx, ctx.teamId)

        return created
      })

      return new Output(true, ["Remetente criado com sucesso"], [], sender)
    } catch (error) {
      console.error("[EmailTeamSettingsUseCase][createSender]", error)
      return new Output(false, [], ["Erro ao criar remetente"], null)
    }
  }

  async updateSender(senderId: string, input: UpsertEmailSenderInput, ctx: TeamContext): Promise<Output> {
    try {
      const validationError = validateSenderInput(input)
      if (validationError) return new Output(false, [], [validationError], null)

      const settings = await prisma.emailTeamSettings.findUnique({
        where: { teamId: ctx.teamId },
        select: { resendDomainName: true, resendDomainStatus: true },
      })
      const domainError = validateSenderEmailForDomain(
        input.email,
        settings?.resendDomainName,
        settings?.resendDomainStatus
      )
      if (domainError) return new Output(false, [], [domainError], null)

      const sender = await prisma.$transaction(async (tx) => {
        const existing = await tx.emailTeamSender.findFirst({
          where: { id: senderId, teamId: ctx.teamId },
          select: senderSelect,
        })
        if (!existing) {
          throw new Error("NOT_FOUND")
        }

        const updated = await tx.emailTeamSender.update({
          where: { id: senderId },
          data: normalizeSenderPayload(input),
          select: senderSelect,
        })

        await this.ensureSingleDefaultSender(tx, ctx.teamId)
        return updated
      })

      return new Output(true, ["Remetente atualizado com sucesso"], [], sender)
    } catch (error) {
      if (error instanceof Error && error.message === "NOT_FOUND") {
        return new Output(false, [], ["Remetente não encontrado"], null)
      }
      console.error("[EmailTeamSettingsUseCase][updateSender]", error)
      return new Output(false, [], ["Erro ao atualizar remetente"], null)
    }
  }

  async deleteSender(senderId: string, ctx: TeamContext): Promise<Output> {
    try {
      await prisma.$transaction(async (tx) => {
        const existing = await tx.emailTeamSender.findFirst({
          where: { id: senderId, teamId: ctx.teamId },
          select: { id: true },
        })
        if (!existing) {
          throw new Error("NOT_FOUND")
        }

        await tx.emailTeamSender.delete({ where: { id: senderId } })
        await this.ensureSingleDefaultSender(tx, ctx.teamId)
      })

      return new Output(true, ["Remetente removido com sucesso"], [], null)
    } catch (error) {
      if (error instanceof Error && error.message === "NOT_FOUND") {
        return new Output(false, [], ["Remetente não encontrado"], null)
      }
      console.error("[EmailTeamSettingsUseCase][deleteSender]", error)
      return new Output(false, [], ["Erro ao remover remetente"], null)
    }
  }

  async setDefaultSender(senderId: string, ctx: TeamContext): Promise<Output> {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const sender = await tx.emailTeamSender.findFirst({
          where: { id: senderId, teamId: ctx.teamId },
          select: senderSelect,
        })
        if (!sender) {
          throw new Error("NOT_FOUND")
        }

        await tx.emailTeamSender.updateMany({
          where: { teamId: ctx.teamId, isDefault: true },
          data: { isDefault: false },
        })

        await tx.emailTeamSender.update({
          where: { id: senderId },
          data: { isDefault: true },
        })

        await this.syncLegacySenderFields(tx, ctx.teamId, {
          name: sender.name,
          email: sender.email,
          replyTo: sender.replyTo,
        })

        const settings = await this.getSettingsRecord(tx, ctx.teamId)
        const senders = await this.getSenders(tx, ctx.teamId)
        const variables = await this.getVariables(tx, ctx.teamId)
        return this.composeResult(settings, senders, variables)
      })

      return new Output(true, ["Remetente padrão atualizado"], [], result)
    } catch (error) {
      if (error instanceof Error && error.message === "NOT_FOUND") {
        return new Output(false, [], ["Remetente não encontrado"], null)
      }
      console.error("[EmailTeamSettingsUseCase][setDefaultSender]", error)
      return new Output(false, [], ["Erro ao definir remetente padrão"], null)
    }
  }

  async connectDomain(domainName: string, ctx: TeamContext): Promise<Output> {
    try {
      if (!domainName.trim() || domainName.length < 3) {
        return new Output(false, [], ["Nome de domínio inválido"], null)
      }

      const existing = await prisma.emailTeamSettings.findUnique({
        where: { teamId: ctx.teamId },
        select: { resendDomainId: true },
      })
      if (existing?.resendDomainId) {
        return new Output(
          false,
          [],
          ["Já existe um domínio conectado. Remova o domínio atual antes de conectar outro."],
          null
        )
      }

      const resend = assertResend()
      const { data, error } = await resend.domains.create({
        name: domainName.trim(),
        region: DEFAULT_DOMAIN_REGION,
        customReturnPath: "bounce",
        openTracking: true,
        clickTracking: false,
        trackingSubdomain: DEFAULT_TRACKING_SUBDOMAIN,
      })
      if (error || !data) {
        console.error("[EmailTeamSettingsUseCase][connectDomain] Resend error", error)
        return new Output(
          false,
          [],
          [mapResendDomainError(error?.message, "connect", domainName.trim())],
          null
        )
      }

      // Click tracking fica desligado: ele reescreve todo href do template para
      // o subdomínio de tracking, e esse redirecionador é penalizado pelo Safe
      // Browsing ("link parece perigoso" no Gmail). O clique é medido no
      // first-party, pelo `cs_el` carimbado na URL do formulário. O
      // `trackingSubdomain` continua sendo criado porque o open tracking usa o
      // mesmo CNAME.
      //
      // O `create` acima já nasce com `clickTracking: false` — não há janela em
      // que o redirecionador exista. Este update é reforço, e o erro dele é
      // verificado: sem isso, uma falha aqui deixaria o provedor divergente do
      // que gravamos no banco e a operação ainda reportaria sucesso.
      const { error: trackingError } = await resend.domains.update({
        id: data.id,
        openTracking: true,
        clickTracking: false,
        trackingSubdomain: DEFAULT_TRACKING_SUBDOMAIN,
      })
      if (trackingError) {
        console.error(
          "[EmailTeamSettingsUseCase][connectDomain] Resend tracking error",
          trackingError
        )
        return new Output(
          false,
          [],
          [mapResendDomainError(trackingError.message, "connect", domainName.trim())],
          null
        )
      }

      const connectedAt = new Date()
      const senderCount = await prisma.emailTeamSender.count({ where: { teamId: ctx.teamId } })
      const deliveryFromEmail = buildDeliveryFromEmail(data.name)

      await prisma.emailTeamSettings.upsert({
        where: { teamId: ctx.teamId },
        create: {
          teamId: ctx.teamId,
          fromName: DEFAULTS.fromName,
          fromEmail: senderCount === 0 ? deliveryFromEmail : DEFAULTS.fromEmail,
          resendDomainId: data.id,
          resendDomainName: data.name,
          resendDomainStatus: "pending",
          resendDomainRegion: DEFAULT_DOMAIN_REGION,
          resendDomainConnectedAt: connectedAt,
          resendOpenTracking: true,
          resendClickTracking: false,
          dispatchAllowedRoles: DEFAULTS.dispatchAllowedRoles,
          templateCreateRoles: DEFAULTS.templateCreateRoles,
          templateApprovalRequired: DEFAULTS.templateApprovalRequired,
          templateApprovalRoles: DEFAULTS.templateApprovalRoles,
          blockedDispatchDays: DEFAULTS.blockedDispatchDays,
        },
        update: {
          resendDomainId: data.id,
          resendDomainName: data.name,
          resendDomainStatus: "pending",
          resendDomainRegion: DEFAULT_DOMAIN_REGION,
          resendDomainConnectedAt: connectedAt,
          resendOpenTracking: true,
          resendClickTracking: false,
          ...(senderCount === 0
            ? {
                fromEmail: deliveryFromEmail,
                fromName: DEFAULTS.fromName,
              }
            : {}),
        },
      })

      await emailTeamDomainEventRepository.recordEventIfMissing(ctx.teamId, "domain_added", connectedAt, {
        domainId: data.id,
        domainName: data.name,
      })

      return new Output(true, ["Domínio conectado. Configure os registros DNS abaixo."], [], {
        domainId: data.id,
        domainName: data.name,
        status: "pending",
        region: DEFAULT_DOMAIN_REGION,
        connectedAt: connectedAt.toISOString(),
        openTracking: true,
        clickTracking: true,
        trackingSubdomain: DEFAULT_TRACKING_SUBDOMAIN,
        records: data.records ?? [],
      })
    } catch (error) {
      console.error("[EmailTeamSettingsUseCase][connectDomain]", error)
      return new Output(false, [], ["Erro ao conectar domínio"], null)
    }
  }

  async configureDomainTracking(
    input: ConfigureDomainTrackingInput,
    ctx: TeamContext
  ): Promise<Output> {
    try {
      if (!input.openTracking && !input.clickTracking) {
        return new Output(
          false,
          [],
          ["Habilite pelo menos abertura ou cliques para configurar o tracking."],
          null
        )
      }

      const trackingSubdomain = normalizeTrackingSubdomain(input.trackingSubdomain)
      if (!trackingSubdomain) {
        return new Output(
          false,
          [],
          [
            "Subdomínio de tracking inválido. Use apenas letras minúsculas, números e hífen (ex.: links).",
          ],
          null
        )
      }

      const settings = await prisma.emailTeamSettings.findUnique({
        where: { teamId: ctx.teamId },
        select: { resendDomainId: true, resendDomainName: true },
      })
      if (!settings?.resendDomainId) {
        return new Output(false, [], ["Nenhum domínio conectado para configurar tracking"], null)
      }

      const resend = assertResend()
      const { data: currentDomain, error: currentError } = await resend.domains.get(
        settings.resendDomainId
      )
      if (currentError || !currentDomain) {
        console.error(
          "[EmailTeamSettingsUseCase][configureDomainTracking] Resend get error",
          currentError
        )
        return new Output(
          false,
          [],
          [
            mapResendDomainError(
              currentError?.message,
              "tracking",
              settings.resendDomainName ?? undefined
            ),
          ],
          null
        )
      }

      const existingTrackingSubdomain =
        currentDomain.tracking_subdomain?.trim().toLowerCase() || null
      const trackingAlreadyConfigured = existingTrackingSubdomain === trackingSubdomain

      const updatePayload: {
        id: string
        openTracking: boolean
        clickTracking: boolean
        trackingSubdomain?: string
      } = {
        id: settings.resendDomainId,
        openTracking: input.openTracking,
        clickTracking: input.clickTracking,
      }
      if (!trackingAlreadyConfigured) {
        updatePayload.trackingSubdomain = trackingSubdomain
      }

      const { error } = await resend.domains.update(updatePayload)

      const maybeTrackingConflict =
        Boolean(error) &&
        (error?.statusCode === 409 || isTrackingSubdomainAlreadyExists(error?.message))

      if (error && !maybeTrackingConflict) {
        console.error("[EmailTeamSettingsUseCase][configureDomainTracking] Resend error", error)
        return new Output(
          false,
          [],
          [
            mapResendDomainError(
              error.message,
              "tracking",
              settings.resendDomainName ?? undefined
            ),
          ],
          null
        )
      }

      const { data: domainData, error: getError } = await resend.domains.get(
        settings.resendDomainId
      )
      if (getError || !domainData) {
        console.error(
          "[EmailTeamSettingsUseCase][configureDomainTracking] Resend get error",
          getError
        )
        return new Output(
          false,
          [],
          [mapResendDomainError(getError?.message, "tracking", settings.resendDomainName ?? undefined)],
          null
        )
      }

      const syncedTrackingSubdomain =
        domainData.tracking_subdomain?.trim().toLowerCase() || null
      // Idempotent only when THIS domain already owns the requested subdomain.
      // Unrelated 409s (e.g. subdomain on another domain) must surface as errors.
      const trackingConflict =
        maybeTrackingConflict &&
        (existingTrackingSubdomain === trackingSubdomain ||
          syncedTrackingSubdomain === trackingSubdomain)

      if (error && !trackingConflict) {
        console.error(
          "[EmailTeamSettingsUseCase][configureDomainTracking] Resend conflict not owned by domain",
          {
            domainId: settings.resendDomainId,
            trackingSubdomain,
            existingTrackingSubdomain,
            syncedTrackingSubdomain,
            error,
          }
        )
        return new Output(
          false,
          [],
          [
            mapResendDomainError(
              error.message,
              "tracking",
              settings.resendDomainName ?? undefined
            ),
          ],
          null
        )
      }

      if (trackingConflict) {
        console.info(
          "[EmailTeamSettingsUseCase][configureDomainTracking] Tracking subdomain already exists; syncing current domain state",
          { domainId: settings.resendDomainId, trackingSubdomain }
        )
      }

      const synced = await emailTeamDomainEventRepository.syncFromResendDomain(
        ctx.teamId,
        domainData,
        new Date()
      )

      const successMessage = trackingConflict
        ? "Subdomínio de tracking já existia no Resend. Status sincronizado — adicione o DNS de Tracking e re-verifique, se pendente."
        : "Métricas de tracking configuradas. Adicione o registro DNS de Tracking e re-verifique."

      return new Output(true, [successMessage], [], {
        domainId: domainData.id,
        domainName: domainData.name,
        status: synced.status as ResendDomainStatus,
        region: synced.region,
        openTracking: synced.openTracking,
        clickTracking: synced.clickTracking,
        trackingSubdomain: synced.trackingSubdomain ?? trackingSubdomain,
        records: domainData.records ?? [],
      })
    } catch (error) {
      console.error("[EmailTeamSettingsUseCase][configureDomainTracking]", error)
      return new Output(false, [], ["Erro ao configurar métricas de tracking"], null)
    }
  }

  async disconnectDomain(ctx: TeamContext): Promise<Output> {
    try {
      const settings = await prisma.emailTeamSettings.findUnique({
        where: { teamId: ctx.teamId },
        select: {
          resendDomainId: true,
          resendDomainName: true,
          fromEmail: true,
        },
      })
      if (!settings?.resendDomainId) {
        return new Output(false, [], ["Nenhum domínio conectado"], null)
      }

      const resend = assertResend()
      const { error } = await resend.domains.remove(settings.resendDomainId)
      if (error) {
        console.error("[EmailTeamSettingsUseCase][disconnectDomain] Resend error", error)
        return new Output(
          false,
          [],
          [
            mapResendDomainError(
              error.message,
              "disconnect",
              settings.resendDomainName ?? undefined
            ),
          ],
          null
        )
      }

      const deletedAt = new Date()
      await emailTeamDomainEventRepository.recordEventIfMissing(ctx.teamId, "domain_deleted", deletedAt, {
        domainId: settings.resendDomainId,
        domainName: settings.resendDomainName,
      })

      const domainDelivery = settings.resendDomainName
        ? buildDeliveryFromEmail(settings.resendDomainName)
        : null
      const shouldResetFrom =
        !settings.fromEmail ||
        isPlatformDefaultFromEmail(settings.fromEmail) ||
        (domainDelivery !== null &&
          settings.fromEmail.trim().toLowerCase() === domainDelivery)

      await prisma.emailTeamSettings.update({
        where: { teamId: ctx.teamId },
        data: {
          ...CLEAR_DOMAIN_DATA,
          ...(shouldResetFrom
            ? { fromEmail: PLATFORM_FROM_EMAIL, fromName: PLATFORM_FROM_NAME }
            : {}),
        },
      })

      return new Output(true, ["Domínio removido com sucesso"], [], null)
    } catch (error) {
      console.error("[EmailTeamSettingsUseCase][disconnectDomain]", error)
      return new Output(false, [], ["Erro ao desconectar domínio"], null)
    }
  }

  async verifyDomain(ctx: TeamContext): Promise<Output> {
    try {
      const settings = await prisma.emailTeamSettings.findUnique({
        where: { teamId: ctx.teamId },
        select: { resendDomainId: true },
      })
      if (!settings?.resendDomainId) {
        return new Output(false, [], ["Nenhum domínio conectado para verificar"], null)
      }

      const resend = assertResend()
      const { error } = await resend.domains.verify(settings.resendDomainId)
      if (error) {
        console.error("[EmailTeamSettingsUseCase][verifyDomain] Resend error", error)
        return new Output(false, [], [mapResendDomainError(error.message, "verify")], null)
      }

      const { data: domainData } = await resend.domains.get(settings.resendDomainId)
      if (!domainData) {
        return new Output(false, [], ["Domínio não encontrado no Resend"], null)
      }

      const synced = await emailTeamDomainEventRepository.syncFromResendDomain(
        ctx.teamId,
        domainData,
        new Date()
      )

      return new Output(true, ["Verificação iniciada"], [], {
        status: synced.status as ResendDomainStatus,
        region: synced.region,
        openTracking: synced.openTracking,
        clickTracking: synced.clickTracking,
        trackingSubdomain: synced.trackingSubdomain,
      })
    } catch (error) {
      console.error("[EmailTeamSettingsUseCase][verifyDomain]", error)
      return new Output(false, [], ["Erro ao verificar domínio"], null)
    }
  }

  async getDomainRecords(ctx: TeamContext): Promise<Output> {
    try {
      const settings = await prisma.emailTeamSettings.findUnique({
        where: { teamId: ctx.teamId },
        select: {
          resendDomainId: true,
          resendDomainName: true,
          resendDomainStatus: true,
          resendDomainRegion: true,
          resendDomainConnectedAt: true,
          resendOpenTracking: true,
          resendClickTracking: true,
        },
      })
      if (!settings?.resendDomainId) {
        return new Output(false, [], ["Nenhum domínio conectado"], null)
      }

      const resend = assertResend()
      const { data, error } = await resend.domains.get(settings.resendDomainId)
      if (error || !data) {
        console.error("[EmailTeamSettingsUseCase][getDomainRecords] Resend error", error)
        return new Output(
          false,
          [],
          [
            mapResendDomainError(
              error?.message,
              "records",
              settings.resendDomainName ?? undefined
            ),
          ],
          null
        )
      }

      const synced = await emailTeamDomainEventRepository.syncFromResendDomain(
        ctx.teamId,
        data,
        new Date()
      )

      const domainEvents = await emailTeamDomainEventRepository.listEvents(ctx.teamId)

      return new Output(true, [], [], {
        domainId: data.id,
        domainName: data.name,
        status: synced.status,
        region: synced.region ?? settings.resendDomainRegion,
        connectedAt: settings.resendDomainConnectedAt?.toISOString() ?? null,
        openTracking: synced.openTracking,
        clickTracking: synced.clickTracking,
        trackingSubdomain: synced.trackingSubdomain,
        records: data.records ?? [],
        events: domainEvents.map((event) => ({
          ...event,
          occurredAt: event.occurredAt.toISOString(),
        })),
      })
    } catch (error) {
      console.error("[EmailTeamSettingsUseCase][getDomainRecords]", error)
      return new Output(false, [], ["Erro ao buscar registros DNS"], null)
    }
  }
}
