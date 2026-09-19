import { Output } from "@/lib/output"
import { notifySendingHealthChanged } from "@/lib/email/notify-sending-health-change"
import { emailSendingHealthRepository } from "@/app/api/infra/data/repositories/emailSendingHealth/EmailSendingHealthRepository"
import type { IEmailSendingHealthRepository } from "@/app/api/infra/data/repositories/emailSendingHealth/IEmailSendingHealthRepository"
import {
  buildSendingHealthSnapshot,
  computeSendingHealthRates,
  parseSendingHealthSnapshot,
  resolveActiveReleaseBaseline,
  resolveSendingHealthTransition,
  type EmailSendingHealthStatusValue,
  type SendingHealthWindowMetrics,
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
          const parsedSnapshot = parseSendingHealthSnapshot(team.metricsJson)
          const activeBaseline = resolveActiveReleaseBaseline({
            baseline: parsedSnapshot.releaseBaseline,
            now,
          })

          // Janela LÍQUIDA: depois de uma liberação manual, só conta o que foi
          // enviado DEPOIS dela. Consulta DIRETA "desde a liberação", não
          // subtração de janelas agregadas — subtrair (janela atual − janela
          // na liberação) zera quando o volume novo ruim substitui volume
          // antigo que sai da janela no mesmo ritmo (achado P1 do codex no
          // PR #1204). Sem essa correção, o mesmo incidente reclassificaria
          // `pause` no tick seguinte e a liberação viraria suspensão imediata
          // — e um incidente NOVO ficaria invisível sob churn de volume.
          const windows: SendingHealthWindowMetrics = activeBaseline
            ? {
                ...team.windows,
                ...(await this.repository.getWindowMetricsSince(
                  team.teamId,
                  new Date(activeBaseline.at),
                  now
                )),
              }
            : team.windows
          const rates = computeSendingHealthRates(windows)
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
            // Uma pausa nova reabre o ciclo: o baseline antigo não vale mais.
            releaseBaseline:
              transition.next === "paused" || transition.next === "suspended"
                ? null
                : activeBaseline,
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

          await notifySendingHealthChanged({
            recipientProfileId: team.masterProfileId,
            teamId: team.teamId,
            status: transition.next,
            previousStatus: team.status,
            reason: transition.reason,
            message: this.buildTransitionMessage(transition.next, transition.reason),
            trigger: "cron_evaluation",
            extraMetadata: {
              rates: {
                hardBounceRate7d: rates.hardBounceRate7d,
                complaintRate7d: rates.complaintRate7d,
                hasMinimumVolume: rates.hasMinimumVolume,
              },
            },
          }).catch((notifyError) => {
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
