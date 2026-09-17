import { NotificationType } from "@prisma/client"
import { Output } from "@/lib/output"
import { notificationService } from "@/app/api/services/notifications/NotificationService"
import { emailSendingHealthRepository } from "@/app/api/infra/data/repositories/emailSendingHealth/EmailSendingHealthRepository"
import type { IEmailSendingHealthRepository } from "@/app/api/infra/data/repositories/emailSendingHealth/IEmailSendingHealthRepository"
import {
  buildSendingHealthSnapshot,
  computeSendingHealthRates,
  parseSendingHealthSnapshot,
  resolveSendingHealthTransition,
  type EmailSendingHealthStatusValue,
} from "@/lib/email/sending-health"

/**
 * Cron `evaluate-sending-health`: janelas móveis 7d/30d por time sobre
 * EmailLog/EmailEvent (hard bounce = Permanent, mesma semântica de
 * `lib/email/bounce-suppression.ts`) → máquina de transição pura de
 * `lib/email/sending-health.ts` → persistência + notificação do owner.
 *
 * paused/suspended NUNCA saem daqui — liberação é manual (owner/backoffice).
 */
export class EvaluateTeamSendingHealthUseCase {
  constructor(
    private readonly repository: IEmailSendingHealthRepository = emailSendingHealthRepository
  ) {}

  private buildTransitionMessage(
    next: EmailSendingHealthStatusValue,
    reason: string | null
  ): string {
    const reasonPart = reason ? ` ${reason}` : ""
    switch (next) {
      case "warned":
        return `Atenção: a saúde de envio do seu time entrou em alerta.${reasonPart} Higienize suas listas antes do próximo disparo.`
      case "paused":
        return `Envio de campanhas pausado automaticamente.${reasonPart} Partes agendadas foram adiadas; higienize as listas e libere o envio.`
      case "suspended":
        return `Envio de campanhas suspenso.${reasonPart}`
      case "healthy":
      default:
        return `Saúde de envio recuperada.${reasonPart}`
    }
  }

  async execute(now = new Date()): Promise<Output> {
    try {
      const teams = await this.repository.listTeamsForEvaluation(now)
      let transitions = 0
      let failures = 0

      for (const team of teams) {
        try {
          const rates = computeSendingHealthRates(team.windows)
          const parsedSnapshot = parseSendingHealthSnapshot(team.metricsJson)
          const transition = resolveSendingHealthTransition({
            current: team.status as EmailSendingHealthStatusValue,
            rates,
            now,
            belowWarnSince: parsedSnapshot.belowWarnSince,
            pauseHistory: parsedSnapshot.pauseHistory,
          })

          const snapshot = buildSendingHealthSnapshot({
            now,
            windows: team.windows,
            rates,
            belowWarnSince: transition.belowWarnSince,
            pauseHistory: transition.pauseHistory,
          })

          await this.repository.updateTeamSendingHealth({
            teamId: team.teamId,
            snapshot,
            transition: transition.changed
              ? { status: transition.next, reason: transition.reason, changedAt: now }
              : undefined,
          })

          if (!transition.changed) continue

          transitions += 1
          console.info(
            `[EvaluateTeamSendingHealthUseCase] teamId=${team.teamId} ${team.status} → ${transition.next} — ${transition.reason ?? "sem motivo"}`
          )

          await notificationService
            .createSystemNotification({
              recipientProfileId: team.masterProfileId,
              teamId: team.teamId,
              type: NotificationType.EMAIL_SENDING_HEALTH_CHANGED,
              message: this.buildTransitionMessage(transition.next, transition.reason),
              metadata: {
                event: "EMAIL_SENDING_HEALTH_CHANGED",
                status: transition.next,
                previousStatus: team.status,
                reason: transition.reason,
                rates: {
                  hardBounceRate7d: rates.hardBounceRate7d,
                  complaintRate7d: rates.complaintRate7d,
                  hasMinimumVolume: rates.hasMinimumVolume,
                },
                trigger: "cron_evaluation",
              },
            })
            .catch((notifyError) => {
              console.error(
                "[EvaluateTeamSendingHealthUseCase] falha ao notificar owner",
                { teamId: team.teamId, error: notifyError }
              )
            })
        } catch (teamError) {
          failures += 1
          console.error("[EvaluateTeamSendingHealthUseCase] falha ao avaliar time", {
            teamId: team.teamId,
            error: teamError,
          })
        }
      }

      return new Output(
        failures === 0,
        [
          `Saúde de envio avaliada: ${teams.length} time(s), ${transitions} transição(ões), ${failures} falha(s)`,
        ],
        failures > 0 ? [`${failures} time(s) falharam na avaliação`] : [],
        { evaluated: teams.length, transitions, failures }
      )
    } catch (error) {
      console.error("[EvaluateTeamSendingHealthUseCase][execute]", error)
      return new Output(false, [], ["Erro ao avaliar saúde de envio dos times"], null)
    }
  }
}

export const evaluateTeamSendingHealthUseCase = new EvaluateTeamSendingHealthUseCase()
