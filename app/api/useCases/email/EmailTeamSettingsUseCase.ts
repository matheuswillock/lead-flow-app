import { Prisma } from "@prisma/client"
import { Output } from "@/lib/output"
import { prisma } from "@/app/api/infra/data/prisma"
import { assertResend } from "@/lib/email"
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

const VALID_ROLES = ["manager", "backoffice", "operator"] as const
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

const DEFAULTS = {
  fromName: "Corretor Studio",
  fromEmail: "no-reply@corretorstudio.com",
  replyTo: null,
  dispatchBlockedDates: null,
  dispatchTimeFrom: null,
  dispatchTimeTo: null,
  dispatchAllowedRoles: ["manager", "backoffice"],
  templateCreateRoles: ["manager", "backoffice"],
  templateApprovalRequired: false,
  resendDomainId: null,
  resendDomainName: null,
  resendDomainStatus: null,
}

export interface UpdateEmailSettingsInput {
  fromName?: string
  fromEmail?: string
  replyTo?: string | null
  dispatchBlockedDates?: BlockedDateRange[] | null
  dispatchTimeFrom?: string | null
  dispatchTimeTo?: string | null
  dispatchAllowedRoles?: string[]
  templateCreateRoles?: string[]
  templateApprovalRequired?: boolean
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
      if (entry.from > entry.to) return `Intervalo inválido: 'from' deve ser anterior a 'to'`
    }
  }
  return null
}

export class EmailTeamSettingsUseCase {
  async get(ctx: TeamContext): Promise<Output> {
    try {
      const settings = await prisma.emailTeamSettings.findUnique({
        where: { teamId: ctx.teamId },
      })
      return new Output(true, [], [], settings ?? DEFAULTS)
    } catch (error) {
      console.error("[EmailTeamSettingsUseCase][get]", error)
      return new Output(false, [], ["Erro ao buscar configurações de email"], null)
    }
  }

  async update(data: UpdateEmailSettingsInput, ctx: TeamContext): Promise<Output> {
    try {
      if (data.fromName !== undefined && !data.fromName.trim()) {
        return new Output(false, [], ["Nome do remetente não pode ser vazio"], null)
      }
      if (data.fromEmail !== undefined && !data.fromEmail.trim()) {
        return new Output(false, [], ["Email do remetente não pode ser vazio"], null)
      }
      if (data.dispatchTimeFrom !== undefined && data.dispatchTimeFrom !== null) {
        if (!TIME_RE.test(data.dispatchTimeFrom)) {
          return new Output(false, [], ["Horário de início inválido. Use o formato HH:mm"], null)
        }
      }
      if (data.dispatchTimeTo !== undefined && data.dispatchTimeTo !== null) {
        if (!TIME_RE.test(data.dispatchTimeTo)) {
          return new Output(false, [], ["Horário de fim inválido. Use o formato HH:mm"], null)
        }
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
      if (data.dispatchBlockedDates !== undefined && data.dispatchBlockedDates !== null) {
        const err = validateBlockedDates(data.dispatchBlockedDates)
        if (err) return new Output(false, [], [err], null)
      }

      const settings = await prisma.emailTeamSettings.upsert({
        where: { teamId: ctx.teamId },
        create: {
          teamId: ctx.teamId,
          fromName: data.fromName?.trim() ?? DEFAULTS.fromName,
          fromEmail: data.fromEmail?.trim() ?? DEFAULTS.fromEmail,
          replyTo: data.replyTo?.trim() || null,
          dispatchBlockedDates: data.dispatchBlockedDates ?? undefined,
          dispatchTimeFrom: data.dispatchTimeFrom ?? null,
          dispatchTimeTo: data.dispatchTimeTo ?? null,
          dispatchAllowedRoles: data.dispatchAllowedRoles ?? DEFAULTS.dispatchAllowedRoles,
          templateCreateRoles: data.templateCreateRoles ?? DEFAULTS.templateCreateRoles,
          templateApprovalRequired: data.templateApprovalRequired ?? false,
        },
        update: {
          ...(data.fromName !== undefined && { fromName: data.fromName.trim() }),
          ...(data.fromEmail !== undefined && { fromEmail: data.fromEmail.trim() }),
          ...(data.replyTo !== undefined && { replyTo: data.replyTo?.trim() || null }),
          ...(data.dispatchBlockedDates !== undefined && {
            dispatchBlockedDates: data.dispatchBlockedDates === null ? Prisma.DbNull : data.dispatchBlockedDates,
          }),
          ...(data.dispatchTimeFrom !== undefined && { dispatchTimeFrom: data.dispatchTimeFrom }),
          ...(data.dispatchTimeTo !== undefined && { dispatchTimeTo: data.dispatchTimeTo }),
          ...(data.dispatchAllowedRoles !== undefined && { dispatchAllowedRoles: data.dispatchAllowedRoles }),
          ...(data.templateCreateRoles !== undefined && { templateCreateRoles: data.templateCreateRoles }),
          ...(data.templateApprovalRequired !== undefined && { templateApprovalRequired: data.templateApprovalRequired }),
        },
      })

      return new Output(true, ["Configurações salvas com sucesso"], [], settings)
    } catch (error) {
      console.error("[EmailTeamSettingsUseCase][update]", error)
      return new Output(false, [], ["Erro ao salvar configurações de email"], null)
    }
  }

  async connectDomain(domainName: string, ctx: TeamContext): Promise<Output> {
    try {
      if (!domainName.trim() || domainName.length < 3) {
        return new Output(false, [], ["Nome de domínio inválido"], null)
      }

      const resend = assertResend()
      const { data, error } = await resend.domains.create({ name: domainName.trim() })
      if (error || !data) {
        console.error("[EmailTeamSettingsUseCase][connectDomain] Resend error", error)
        return new Output(false, [], [error?.message ?? "Erro ao criar domínio no Resend"], null)
      }

      await prisma.emailTeamSettings.upsert({
        where: { teamId: ctx.teamId },
        create: {
          teamId: ctx.teamId,
          fromName: DEFAULTS.fromName,
          fromEmail: DEFAULTS.fromEmail,
          resendDomainId: data.id,
          resendDomainName: data.name,
          resendDomainStatus: "pending",
        },
        update: {
          resendDomainId: data.id,
          resendDomainName: data.name,
          resendDomainStatus: "pending",
        },
      })

      return new Output(true, ["Domínio conectado. Configure os registros DNS abaixo."], [], {
        domainId: data.id,
        domainName: data.name,
        status: "pending",
        records: data.records ?? [],
      })
    } catch (error) {
      console.error("[EmailTeamSettingsUseCase][connectDomain]", error)
      return new Output(false, [], ["Erro ao conectar domínio"], null)
    }
  }

  async disconnectDomain(ctx: TeamContext): Promise<Output> {
    try {
      const settings = await prisma.emailTeamSettings.findUnique({
        where: { teamId: ctx.teamId },
        select: { resendDomainId: true },
      })
      if (!settings?.resendDomainId) {
        return new Output(false, [], ["Nenhum domínio conectado"], null)
      }

      await prisma.emailTeamSettings.update({
        where: { teamId: ctx.teamId },
        data: { resendDomainId: null, resendDomainName: null, resendDomainStatus: null },
      })

      return new Output(true, ["Domínio desconectado com sucesso"], [], null)
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
        return new Output(false, [], [error.message ?? "Erro ao verificar domínio"], null)
      }

      // Fetch updated status after verification trigger
      const { data: domainData } = await resend.domains.get(settings.resendDomainId)
      const status: ResendDomainStatus = (domainData?.status as ResendDomainStatus | undefined) ?? "pending"
      await prisma.emailTeamSettings.update({
        where: { teamId: ctx.teamId },
        data: { resendDomainStatus: status },
      })

      return new Output(true, ["Verificação iniciada"], [], { status })
    } catch (error) {
      console.error("[EmailTeamSettingsUseCase][verifyDomain]", error)
      return new Output(false, [], ["Erro ao verificar domínio"], null)
    }
  }

  async getDomainRecords(ctx: TeamContext): Promise<Output> {
    try {
      const settings = await prisma.emailTeamSettings.findUnique({
        where: { teamId: ctx.teamId },
        select: { resendDomainId: true, resendDomainName: true, resendDomainStatus: true },
      })
      if (!settings?.resendDomainId) {
        return new Output(false, [], ["Nenhum domínio conectado"], null)
      }

      const resend = assertResend()
      const { data, error } = await resend.domains.get(settings.resendDomainId)
      if (error || !data) {
        console.error("[EmailTeamSettingsUseCase][getDomainRecords] Resend error", error)
        return new Output(false, [], [error?.message ?? "Erro ao buscar registros DNS"], null)
      }

      const newStatus = (data.status as ResendDomainStatus | undefined) ?? settings.resendDomainStatus
      if (newStatus !== settings.resendDomainStatus) {
        await prisma.emailTeamSettings.update({
          where: { teamId: ctx.teamId },
          data: { resendDomainStatus: newStatus },
        })
      }

      return new Output(true, [], [], {
        domainId: data.id,
        domainName: data.name,
        status: newStatus,
        records: data.records ?? [],
      })
    } catch (error) {
      console.error("[EmailTeamSettingsUseCase][getDomainRecords]", error)
      return new Output(false, [], ["Erro ao buscar registros DNS"], null)
    }
  }
}
