import { Prisma } from "@prisma/client"
import { Output } from "@/lib/output"
import { prisma } from "@/app/api/infra/data/prisma"
import type { UpdateEmailSettingsInput } from "@/app/api/useCases/email/EmailTeamSettingsUseCase"

const PAGE_SIZE_MAX = 50

export class BackofficeEmailSettingsUseCase {
  async list(options: { search?: string; page: number; pageSize: number }): Promise<Output> {
    try {
      const page = Math.max(1, options.page)
      const pageSize = Math.min(options.pageSize, PAGE_SIZE_MAX)
      const skip = (page - 1) * pageSize

      const where = options.search
        ? {
            master: {
              OR: [
                { fullName: { contains: options.search, mode: "insensitive" as const } },
                { email: { contains: options.search, mode: "insensitive" as const } },
              ],
            },
          }
        : undefined

      const [teams, total] = await Promise.all([
        prisma.team.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            master: { select: { id: true, fullName: true, email: true } },
            emailSettings: {
              select: {
                fromName: true,
                fromEmail: true,
                replyTo: true,
                dispatchBlockedDates: true,
                dispatchTimeFrom: true,
                dispatchTimeTo: true,
                dispatchAllowedRoles: true,
                templateCreateRoles: true,
                templateApprovalRequired: true,
                resendDomainId: true,
                resendDomainName: true,
                resendDomainStatus: true,
              },
            },
          },
        }),
        prisma.team.count({ where }),
      ])

      const items = teams.map((t) => ({
        teamId: t.id,
        teamName: t.master.fullName ?? t.master.email,
        masterEmail: t.master.email,
        settings: t.emailSettings ?? null,
      }))

      return new Output(true, [], [], {
        items,
        total,
        page,
        totalPages: Math.ceil(total / pageSize),
      })
    } catch (error) {
      console.error("[BackofficeEmailSettingsUseCase][list]", error)
      return new Output(false, [], ["Erro ao listar configurações de email"], null)
    }
  }

  async getByTeamId(teamId: string): Promise<Output> {
    try {
      const settings = await prisma.emailTeamSettings.findUnique({
        where: { teamId },
      })

      return new Output(true, [], [], settings ?? { teamId, fromName: "Corretor Studio", fromEmail: "no-reply@corretorstudio.com", replyTo: null })
    } catch (error) {
      console.error("[BackofficeEmailSettingsUseCase][getByTeamId]", error)
      return new Output(false, [], ["Erro ao buscar configurações do time"], null)
    }
  }

  async update(teamId: string, data: UpdateEmailSettingsInput): Promise<Output> {
    try {
      const team = await prisma.team.findUnique({ where: { id: teamId }, select: { id: true } })
      if (!team) {
        return new Output(false, [], ["Time não encontrado"], null)
      }

      const settings = await prisma.emailTeamSettings.upsert({
        where: { teamId },
        create: {
          teamId,
          fromName: data.fromName?.trim() ?? "Corretor Studio",
          fromEmail: data.fromEmail?.trim() ?? "no-reply@corretorstudio.com",
          replyTo: data.replyTo?.trim() || null,
          dispatchBlockedDates: data.dispatchBlockedDates ?? undefined,
          dispatchTimeFrom: data.dispatchTimeFrom ?? null,
          dispatchTimeTo: data.dispatchTimeTo ?? null,
          dispatchAllowedRoles: data.dispatchAllowedRoles ?? ["manager", "backoffice"],
          templateCreateRoles: data.templateCreateRoles ?? ["manager", "backoffice"],
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
      console.error("[BackofficeEmailSettingsUseCase][update]", error)
      return new Output(false, [], ["Erro ao salvar configurações"], null)
    }
  }
}
