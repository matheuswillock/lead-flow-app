import { Output } from "@/lib/output"
import { notifySendingHealthChanged } from "@/lib/email/notify-sending-health-change"
import { emailSendingHealthRepository } from "@/app/api/infra/data/repositories/emailSendingHealth/EmailSendingHealthRepository"
import type { IEmailSendingHealthRepository } from "@/app/api/infra/data/repositories/emailSendingHealth/IEmailSendingHealthRepository"
import type { TeamAccess as TeamContext } from "@/app/api/v1/utils/teamAccess"
import { resolveManualSendingHealthRelease } from "@/lib/email/sending-health"

/**
 * Liberação MANUAL da trava de reputação pelo lado do PRODUTO: somente o
 * owner (master) do time, e somente `paused` → `warned`. `suspended` é
 * exclusivo do backoffice (`resolveManualSendingHealthRelease` recusa).
 */
export class ReleaseTeamSendingHealthUseCase {
  constructor(
    private readonly repository: IEmailSendingHealthRepository = emailSendingHealthRepository
  ) {}

  async execute(ctx: TeamContext): Promise<Output> {
    try {
      if (!ctx.isMaster) {
        return new Output(
          false,
          [],
          ["Apenas o responsável (master) do time pode liberar o envio"],
          null
        )
      }

      const state = await this.repository.getTeamSendingHealth(ctx.teamId)
      if (!state) {
        return new Output(false, [], ["Configurações de e-mail do time não encontradas"], null)
      }

      const release = resolveManualSendingHealthRelease({
        current: state.status,
        actor: "team_owner",
      })
      if (!release.ok) {
        return new Output(false, [], [release.message], null)
      }

      const now = new Date()
      await this.repository.updateTeamSendingHealth({
        teamId: ctx.teamId,
        transition: { status: release.next, reason: release.reason, changedAt: now },
      })

      await notifySendingHealthChanged({
        recipientProfileId: state.masterProfileId,
        teamId: ctx.teamId,
        status: release.next,
        previousStatus: state.status,
        reason: release.reason,
        message: `Envio de campanhas liberado (status: em alerta). ${release.reason} O time volta a "saudável" após 14 dias com taxas abaixo do limiar.`,
        trigger: "manual_release_owner",
      }).catch((notifyError) => {
        console.error("[ReleaseTeamSendingHealthUseCase] falha ao notificar", notifyError)
      })

      return new Output(true, ["Envio liberado — o time volta ao status de alerta"], [], {
        status: release.next,
      })
    } catch (error) {
      console.error("[ReleaseTeamSendingHealthUseCase][execute]", error)
      return new Output(false, [], ["Erro ao liberar o envio do time"], null)
    }
  }
}

export const releaseTeamSendingHealthUseCase = new ReleaseTeamSendingHealthUseCase()
