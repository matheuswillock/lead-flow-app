import { Output } from "@/lib/output"
import {
  emailOrphanEventService,
  EmailOrphanEventService,
  ORPHAN_DRAIN_BATCH_SIZE,
} from "@/app/api/services/resend/EmailOrphanEventService"

/**
 * Drena os eventos do Resend que chegaram antes do `EmailLog` existir.
 *
 * Antes o dreno pegava carona no fim do `dispatch-scheduled`, 10 por execução
 * (120/h) — insuficiente para a vazão real e refém do cron de campanhas.
 */
export class DrainEmailOrphanEventsUseCase {
  constructor(
    private readonly orphanEvents: Pick<EmailOrphanEventService, "processPendingBatch"> = emailOrphanEventService,
  ) {}

  async execute(limit: number = ORPHAN_DRAIN_BATCH_SIZE): Promise<Output> {
    try {
      const drained = await this.orphanEvents.processPendingBatch(limit)

      console.info("[DrainEmailOrphanEventsUseCase][execute] dreno concluído", drained)

      return new Output(
        true,
        [`${drained.processed} órfãos processados`],
        [],
        drained,
      )
    } catch (error) {
      console.error("[DrainEmailOrphanEventsUseCase][execute]", error)
      return new Output(false, [], ["Erro ao drenar eventos órfãos do Resend"], null)
    }
  }
}

export const drainEmailOrphanEventsUseCase = new DrainEmailOrphanEventsUseCase()
