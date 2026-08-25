import { Output } from "@/lib/output"
import { emailLogRepository } from "@/app/api/infra/data/repositories/emailLog/EmailLogRepository"
import type { IEmailLogRepository } from "@/app/api/infra/data/repositories/emailLog/IEmailLogRepository"

/**
 * Marca do log expirado. Vive em `EmailEvent.metadata.errorMessage` (o log não
 * tem coluna de erro) e é o que separa "morreu de esquecimento" de "o provedor
 * recusou" na hora de ler a lista de falhas.
 */
export const QUEUED_EXPIRED_ERROR_MESSAGE = "queued_expired"

/** Só o que a expiração precisa do repositório de log (ISP). */
export type IStaleQueuedEmailLogRepository = Pick<IEmailLogRepository, "expireStaleQueuedLogs">

export type ExpireStaleQueuedEmailLogsOptions = {
  /** Idade mínima do log parado. Padrão 48h — cobre reprocesso legítimo. */
  staleAfterMs?: number
  batchSize?: number
}

const DEFAULT_STALE_AFTER_MS = 48 * 60 * 60 * 1000
const DEFAULT_BATCH_SIZE = 2_000

/**
 * `queued` passa a ter dono e prazo.
 *
 * Medido em 2026-08-25: 13.936 logs `queued`, **todos** sem `dispatchId` e
 * todos com mais de 48h — o mais antigo de 01/07. Nenhum deles é alcançável por
 * `reclaimCompletedDispatchesWithQueuedLogs`, que exige um dispatch para
 * reabrir. Sem esta varredura eles ficam `queued` para sempre e o contador de
 * fila mede esquecimento, não trabalho em andamento.
 *
 * O log expirado **nunca** é reenviado: disparar um e-mail de trinta dias atrás
 * é dano, não recuperação. A decisão de reenviar é do usuário, não do cron.
 */
export class ExpireStaleQueuedEmailLogsUseCase {
  private readonly staleAfterMs: number
  private readonly batchSize: number

  constructor(
    private readonly repository: IStaleQueuedEmailLogRepository = emailLogRepository,
    options: ExpireStaleQueuedEmailLogsOptions = {}
  ) {
    this.staleAfterMs = options.staleAfterMs ?? DEFAULT_STALE_AFTER_MS
    this.batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE
  }

  async execute(): Promise<Output> {
    const olderThan = new Date(Date.now() - this.staleAfterMs)

    const expired = await this.repository.expireStaleQueuedLogs({
      olderThan,
      limit: this.batchSize,
      errorMessage: QUEUED_EXPIRED_ERROR_MESSAGE,
    })

    const summary = { expired, hasMore: expired >= this.batchSize, batchSize: this.batchSize }

    if (expired > 0) {
      console.info("[ExpireStaleQueuedEmailLogsUseCase] Logs queued expirados", {
        ...summary,
        olderThan: olderThan.toISOString(),
      })
    }

    return new Output(true, [`${expired} log(s) queued expirado(s)`], [], summary)
  }
}

export const expireStaleQueuedEmailLogsUseCase = new ExpireStaleQueuedEmailLogsUseCase()
