import { Output } from "@/lib/output"
import type { IPublicFormJourneyRepository } from "@/app/api/infra/data/repositories/publicFormJourney/IPublicFormJourneyRepository"
import {
  buildJourneyAbandonmentEventKey,
  PUBLIC_FORM_ABANDONMENT_IDLE_MS,
} from "@/lib/public-forms/journey-session"

export type AbandonmentEventPublisher = (input: {
  formId: string
  publicId: string
  publicationId: string
  visitorSessionId: string
  eventKey: string
  occurredAt: Date
}) => Promise<boolean>

export type MarkAbandonedJourneySessionsResult = {
  claimed: number
  published: number
  failed: number
}

/**
 * Marca como abandonadas as sessões sem atividade há 30 minutos.
 *
 * O claim é atômico no repositório (`FOR UPDATE SKIP LOCKED`), então dois crons
 * concorrentes nunca abandonam a mesma sessão. A chave do evento é
 * `sessão + lastActivityAt`: uma sessão que retoma e abandona de novo gera
 * outra chave, mas a mesma inatividade nunca duplica `form_abandoned`.
 *
 * Sessões `completed` não são candidatas — o filtro do claim já as exclui.
 */
export class MarkAbandonedJourneySessionsUseCase {
  constructor(
    private readonly repository: IPublicFormJourneyRepository,
    private readonly publishAbandonment: AbandonmentEventPublisher,
    private readonly idleMs: number = PUBLIC_FORM_ABANDONMENT_IDLE_MS,
  ) {}

  async execute(limit = 200): Promise<Output> {
    try {
      const idleBefore = new Date(Date.now() - this.idleMs)
      const claimed = await this.repository.claimAbandonedJourneySessions({ idleBefore, limit })

      let published = 0
      let failed = 0
      for (const session of claimed) {
        const accepted = await this.publishAbandonment({
          formId: session.formId,
          publicId: session.publicId,
          publicationId: session.publicationId,
          visitorSessionId: session.visitorSessionId,
          eventKey: buildJourneyAbandonmentEventKey(
            session.visitorSessionId,
            session.lastActivityAt,
          ),
          occurredAt: session.lastActivityAt,
        }).catch((error) => {
          console.error("[MarkAbandonedJourneySessionsUseCase][publish]", {
            sessionId: session.sessionId,
            formId: session.formId,
            error,
          })
          return false
        })

        if (accepted) {
          published += 1
        } else {
          // Reverte para `active` para que o próximo cron possa reintentar a
          // publicação. Sem isso, a sessão ficaria presa em `abandoned` sem o
          // evento `form_abandoned` ter sido publicado, perdendo o fato.
          await this.repository.revertAbandonedJourneySessionToActive(session.sessionId).catch(
            (revertError) => {
              console.error("[MarkAbandonedJourneySessionsUseCase][revert]", {
                sessionId: session.sessionId,
                revertError,
              })
            },
          )
          failed += 1
        }
      }

      console.info("[MarkAbandonedJourneySessionsUseCase][execute] jornadas abandonadas", {
        claimed: claimed.length,
        published,
        failed,
        idleMs: this.idleMs,
      })

      return new Output(true, [], [], {
        claimed: claimed.length,
        published,
        failed,
      } satisfies MarkAbandonedJourneySessionsResult)
    } catch (error) {
      console.error("[MarkAbandonedJourneySessionsUseCase][execute]", error)
      const message =
        error instanceof Error ? error.message : "Erro ao marcar jornadas abandonadas"
      return new Output(false, [], [message], null)
    }
  }
}
