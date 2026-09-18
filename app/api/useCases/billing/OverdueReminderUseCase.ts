import { Output } from "@/lib/output";
import { createEmailService } from "@/lib/services/EmailService";
import { getAppUrl } from "@/lib/utils/app-url";
import { billingEngineRepository } from "@/app/api/infra/data/repositories/billing/BillingEngineRepository";
import { logSubscriptionChange } from "@/lib/billing/logSubscriptionChange";
import { resolveDelinquencyTier, type DelinquencyTier } from "@/lib/billing/delinquency-tier";

const DELINQUENCY_EVENT_TYPE_BY_TIER: Record<"crm_only" | "cut_off", "reduced" | "cut"> = {
  crm_only: "reduced",
  cut_off: "cut",
};

/**
 * 20 — Assinaturas — Backend E9 (Fase 4 do plano de Assinaturas,
 * "Inadimplência em degraus", T-20.28). Antes, este cron reaproveitava
 * `sendSubscriptionConfirmationEmail` (template de confirmação de
 * pagamento) com `value: 0`, media o atraso por `updatedAt` (ignorando quem
 * está atrasado há mais de PAST_DUE_INACTIVE_AFTER_DAYS) e reenviava o
 * mesmo aviso a cada execução — sem dedupe. Agora: mede o atraso pela
 * due date real (`resolveDelinquencyTier`), usa um template próprio por
 * degrau (`sendDelinquencyReminderEmail`) e deduplica via timeline
 * append-only (`SubscriptionChangeLog.eventType`) — só um aviso por degrau
 * por ciclo de atraso.
 */
export class OverdueReminderUseCase {
  async processOverdueReminders(): Promise<Output> {
    const pastDue = await billingEngineRepository.findPastDueSubscriptionsForDunning({
      take: 200,
    });

    const emailService = createEmailService();
    const appUrl = getAppUrl({ removeTrailingSlash: true });
    let sent = 0;
    let failed = 0;
    let deduped = 0;
    let skipped = 0;

    for (const row of pastDue) {
      const email = row.profile.email;
      if (!email || !row.subscriptionNextDueDate) {
        skipped += 1;
        continue;
      }

      const tier: DelinquencyTier = resolveDelinquencyTier({
        subscriptionStatus: "past_due",
        subscriptionNextDueDate: row.subscriptionNextDueDate,
      });

      if (tier === "full_access") {
        // Dias 0-5 de tolerância: nenhum aviso ainda (Fase 4, degrau 0).
        skipped += 1;
        continue;
      }

      const eventType = DELINQUENCY_EVENT_TYPE_BY_TIER[tier];

      try {
        const alreadyNotified = await billingEngineRepository.hasDelinquencyNoticeSince({
          profileId: row.profileId,
          eventType,
          since: row.subscriptionNextDueDate,
        });
        if (alreadyNotified) {
          deduped += 1;
          continue;
        }

        const manageUrl = row.profile.supabaseId
          ? `${appUrl}/${row.profile.supabaseId}/subscription`
          : `${appUrl}/sign-in`;

        const res = await emailService.sendDelinquencyReminderEmail({
          userName: row.profile.fullName || email.split("@")[0],
          userEmail: email,
          tier,
          manageUrl,
          idempotencyKey: `delinquency:${row.profileId}:${tier}:${row.subscriptionNextDueDate.toISOString()}`,
        });

        if (!res.success) {
          failed += 1;
          console.error("[OverdueReminderUseCase] falha e-mail", {
            profileId: row.profileId,
            tier,
            error: res.error,
          });
          continue;
        }

        sent += 1;
        await logSubscriptionChange({
          profileId: row.profileId,
          source: "OverdueReminderUseCase",
          changeType: "delinquency_tier_reminder",
          eventType,
          metadata: { tier, subscriptionNextDueDate: row.subscriptionNextDueDate.toISOString() },
        });
      } catch (error) {
        failed += 1;
        console.error("[OverdueReminderUseCase] erro", {
          profileId: row.profileId,
          tier,
          error,
        });
      }
    }

    console.info("[OverdueReminderUseCase] done", {
      candidates: pastDue.length,
      sent,
      failed,
      deduped,
      skipped,
    });

    return new Output(true, ["Cron overdue-reminder executado"], [], {
      candidates: pastDue.length,
      sent,
      failed,
      deduped,
      skipped,
    });
  }
}

export const overdueReminderUseCase = new OverdueReminderUseCase();
