import type { IPaymentProviderEventInboxRepository } from "@/app/api/infra/data/repositories/paymentProviderEvent/IPaymentProviderEventInboxRepository"
import {
  INBOX_FAILED_LOOKBACK_HOURS,
  evaluateInboxHealth,
  type InboxHealthEvaluation,
  type InboxHealthLimits,
} from "@/lib/payment-provider/inbox-health"
import type { OperationalAlerter } from "@/lib/payment-provider/operational-alerts"
import { paymentProviderAlerter } from "./paymentProviderAlerter"

const ALERT_DEDUPE_WINDOW_MS = 30 * 60_000

export type PaymentProviderInboxMonitorDependencies = {
  readonly inbox: Pick<IPaymentProviderEventInboxRepository, "getHealthSnapshot">
  readonly alerter?: Pick<OperationalAlerter, "alert">
  readonly limits?: InboxHealthLimits
  readonly now?: () => Date
}

/** Avalia a saúde da inbox e alerta (Slack + Sentry) quando a regra de falhas/estagnação dispara. */
export class PaymentProviderInboxMonitor {
  private readonly alerter: Pick<OperationalAlerter, "alert">
  private readonly now: () => Date

  constructor(private readonly dependencies: PaymentProviderInboxMonitorDependencies) {
    this.alerter = dependencies.alerter ?? paymentProviderAlerter
    this.now = dependencies.now ?? (() => new Date())
  }

  async check(): Promise<InboxHealthEvaluation> {
    try {
      const now = this.now()
      const failedSince = new Date(now.getTime() - INBOX_FAILED_LOOKBACK_HOURS * 3_600_000)
      const snapshot = await this.dependencies.inbox.getHealthSnapshot({ failedSince })
      const evaluation = evaluateInboxHealth(snapshot, now, this.dependencies.limits)
      if (!evaluation.healthy) await this.raise(snapshot, evaluation)
      return evaluation
    } catch (error) {
      console.error("[PaymentProviderInboxMonitor][check] Error", {
        message: error instanceof Error ? error.message : "unknown",
      })
      return { healthy: true, reasons: [] }
    }
  }

  private raise(
    snapshot: { failedCount: number; oldestUnfinishedAt: Date | null },
    evaluation: InboxHealthEvaluation,
  ): Promise<void> {
    return this.alerter.alert({
      key: "payment-inbox-unhealthy",
      level: "error",
      slack: true,
      dedupeWindowMs: ALERT_DEDUPE_WINDOW_MS,
      message: "Inbox de eventos do provedor de pagamento com falhas ou sem andamento",
      context: {
        reasons: [...evaluation.reasons],
        failedCount: snapshot.failedCount,
        oldestUnfinishedAt: snapshot.oldestUnfinishedAt?.toISOString() ?? null,
      },
    })
  }
}
