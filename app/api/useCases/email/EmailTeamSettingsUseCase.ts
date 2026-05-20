import { Output } from "@/lib/output"
import { prisma } from "@/app/api/infra/data/prisma"
import type { TeamAccess as TeamContext } from "@/app/api/v1/utils/teamAccess"

export interface UpdateEmailSettingsInput {
  fromName?: string
  fromEmail?: string
  replyTo?: string | null
}

export class EmailTeamSettingsUseCase {
  async get(ctx: TeamContext): Promise<Output> {
    try {
      const settings = await prisma.emailTeamSettings.findUnique({
        where: { teamId: ctx.teamId },
      })

      return new Output(true, [], [], settings ?? {
        fromName: "Corretor Studio",
        fromEmail: "no-reply@corretorstudio.com",
        replyTo: null,
      })
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

      const settings = await prisma.emailTeamSettings.upsert({
        where: { teamId: ctx.teamId },
        create: {
          teamId: ctx.teamId,
          fromName: data.fromName?.trim() ?? "Corretor Studio",
          fromEmail: data.fromEmail?.trim() ?? "no-reply@corretorstudio.com",
          replyTo: data.replyTo?.trim() || null,
        },
        update: {
          ...(data.fromName !== undefined && { fromName: data.fromName.trim() }),
          ...(data.fromEmail !== undefined && { fromEmail: data.fromEmail.trim() }),
          ...(data.replyTo !== undefined && { replyTo: data.replyTo?.trim() || null }),
        },
      })

      return new Output(true, ["Configurações salvas com sucesso"], [], settings)
    } catch (error) {
      console.error("[EmailTeamSettingsUseCase][update]", error)
      return new Output(false, [], ["Erro ao salvar configurações de email"], null)
    }
  }
}
