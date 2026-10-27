import type {
  InboundEventRow,
  ITeamWebhookInboundEventRepository,
} from "@/app/api/infra/data/repositories/teamWebhook/ITeamWebhookInboundEventRepository";
import type { ITeamApiRequestLogRepository } from "@/app/api/infra/data/repositories/teamApiRequestLog/ITeamApiRequestLogRepository";
import { Output } from "@/lib/output";

/** Tamanho do lote por execução do cron (a cada 5 min). Cada evento pode agendar reunião no Google. */
export const INBOUND_RETRY_BATCH_SIZE = 25;

/** Retenção da idempotência e do payload bruto dos eventos terminais (D8: 7 dias). */
export const INBOUND_EVENT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

/** Retenção do log de uso da API Studio (SPEC 14, A-E4): só metadados, 30 dias. */
export const API_REQUEST_LOG_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export type RetryInboundWebhookEventsDeps = {
  events: Pick<ITeamWebhookInboundEventRepository, "claimDue" | "purgeTerminalOlderThan">;
  processBatch: (rows: InboundEventRow[]) => Promise<void>;
  /** Aproveita este cron (já agendado) para aplicar a retenção do log de uso da API Studio. */
  apiRequestLogs?: Pick<ITeamApiRequestLogRepository, "purgeOlderThan">;
  now?: () => Date;
};

/**
 * Cron de retry do webhook v2 (SPEC 11, A-E4): reprocessa eventos que falharam (com backoff, até
 * dead-letter após 5 tentativas) e recupera leases abandonados. Também aplica a retenção de 7 dias
 * dos eventos já terminais, que carregam o payload recebido (PII).
 */
export class RetryInboundWebhookEventsUseCase {
  private readonly now: () => Date;

  constructor(private readonly deps: RetryInboundWebhookEventsDeps) {
    this.now = deps.now ?? (() => new Date());
  }

  async execute(): Promise<Output> {
    try {
      const claimed = await this.deps.events.claimDue(INBOUND_RETRY_BATCH_SIZE);
      if (claimed.length > 0) await this.deps.processBatch(claimed);

      const purged = await this.deps.events.purgeTerminalOlderThan(
        new Date(this.now().getTime() - INBOUND_EVENT_RETENTION_MS),
      );

      const purgedApiLogs = await this.purgeApiRequestLogs();

      return new Output(true, ["Eventos de webhook de entrada reprocessados"], [], {
        claimed: claimed.length,
        purged,
        purgedApiLogs,
      });
    } catch (error) {
      console.error("[RetryInboundWebhookEvents] Erro:", error);
      return new Output(false, [], ["Erro ao reprocessar eventos de webhook de entrada"], null);
    }
  }

  /** A retenção do log de uso nunca derruba o reprocessamento dos eventos. */
  private async purgeApiRequestLogs(): Promise<number> {
    if (!this.deps.apiRequestLogs) return 0;
    try {
      return await this.deps.apiRequestLogs.purgeOlderThan(new Date(this.now().getTime() - API_REQUEST_LOG_RETENTION_MS));
    } catch (error) {
      console.error("[RetryInboundWebhookEvents] Falha ao aplicar a retenção do log de uso da API:", error);
      return 0;
    }
  }
}
