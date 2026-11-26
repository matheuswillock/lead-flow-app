import { isDueDateBeforeTodayInSaoPaulo } from "@/lib/billing/due-date";
import { Output } from "@/lib/output";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_BATCH_SIZE = 200;

export type RouterSubscriptionOverdueSource = {
  listActiveRouterSubscriptionsDueBetween(input: {
    dueSince: Date;
    dueUntil: Date;
    limit: number;
    afterProfileId?: string;
  }): Promise<ReadonlyArray<{ profileId: string; dueDate: Date }>>;
  /** Devolve `false` quando a conta já não está ativa com esse vencimento (pagou ou mudou). */
  markPastDueIfStillDue(profileId: string, dueDate: Date): Promise<boolean>;
};

export type SubscriptionOverdueTransitionDeps = {
  readonly source: RouterSubscriptionOverdueSource;
  /** Registra a transição na linha do tempo da assinatura. */
  readonly recordTransition: (profileId: string) => Promise<void>;
  /** Janela de carência: só contas vencidas dentro dela são marcadas (as mais antigas já estão bloqueadas). */
  readonly graceDays: number;
  readonly batchSize?: number;
};

export type SubscriptionOverdueTransitionSummary = {
  transitioned: number;
  skipped: number;
  failed: number;
};

/**
 * Marca como `past_due` a conta paga pelo roteador cujo vencimento passou. O Asaas faz isso por
 * webhook para as contas dele; no roteador ninguém avisa o atraso, e sem o `past_due` a conta não
 * tem carência nem e-mail de aviso (só `restricted` no dia seguinte). Idempotente: rodar de novo
 * não muda quem já está `past_due`, e quem pagou no meio do caminho não é revertido.
 *
 * Só olha contas vencidas dentro da carência. Quem venceu antes disso já está bloqueado e não é
 * reaberto nem avisado de novo por esta rotina.
 */
export class SubscriptionOverdueTransitionUseCase {
  constructor(private readonly deps: SubscriptionOverdueTransitionDeps) {}

  async execute(now: Date = new Date()): Promise<Output> {
    const summary: SubscriptionOverdueTransitionSummary = { transitioned: 0, skipped: 0, failed: 0 };
    const batchSize = this.deps.batchSize ?? DEFAULT_BATCH_SIZE;
    const dueSince = new Date(now.getTime() - this.deps.graceDays * DAY_MS);
    let afterProfileId: string | undefined;

    for (;;) {
      const page = await this.deps.source.listActiveRouterSubscriptionsDueBetween({
        dueSince,
        dueUntil: now,
        limit: batchSize,
        afterProfileId,
      });
      for (const row of page) {
        afterProfileId = row.profileId;
        await this.transition(row, now, summary);
      }
      if (page.length < batchSize) break;
    }

    return new Output(
      summary.failed === 0,
      ["Transição de vencimento executada"],
      summary.failed === 0 ? [] : [`${summary.failed} conta(s) não puderam ser marcadas como em atraso`],
      summary,
    );
  }

  private async transition(
    row: { profileId: string; dueDate: Date },
    now: Date,
    summary: SubscriptionOverdueTransitionSummary,
  ): Promise<void> {
    if (!isDueDateBeforeTodayInSaoPaulo(row.dueDate, now)) {
      summary.skipped += 1;
      return;
    }
    try {
      const changed = await this.deps.source.markPastDueIfStillDue(row.profileId, row.dueDate);
      if (!changed) {
        summary.skipped += 1;
        return;
      }
      summary.transitioned += 1;
      await this.deps.recordTransition(row.profileId);
    } catch (error) {
      summary.failed += 1;
      console.error("[SubscriptionOverdueTransitionUseCase] falha ao marcar conta em atraso", {
        profileId: row.profileId,
        error,
      });
    }
  }
}
