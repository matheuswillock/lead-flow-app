import { Output } from "@/lib/output";
import { createEmailService } from "@/lib/services/EmailService";
import { getAppUrl } from "@/lib/utils/app-url";
import { billingEngineRepository } from "@/app/api/infra/data/repositories/billing/BillingEngineRepository";
import {
  DELINQUENCY_CRM_ONLY_AFTER_DAYS,
  resolveDelinquencyTier,
  resolveEffectiveNextDueDate,
  type DelinquencyTier,
} from "@/lib/billing/delinquency-tier";

const DELINQUENCY_EVENT_TYPE_BY_TIER: Record<"crm_only" | "cut_off", "reduced" | "cut"> = {
  crm_only: "reduced",
  cut_off: "cut",
};

/** Marca de dedupe na timeline — ver `hasDelinquencyNoticeSince`. */
const DELINQUENCY_REMINDER_CHANGE_TYPE = "delinquency_tier_reminder";
const DELINQUENCY_REMINDER_SOURCE = "OverdueReminderUseCase";
const DUNNING_BATCH_SIZE = 200;

/**
 * 20 — Assinaturas — Backend E9 (Fase 4 do plano de Assinaturas,
 * "Inadimplência em degraus", T-20.28). Antes, este cron reaproveitava
 * `sendSubscriptionConfirmationEmail` (template de confirmação de
 * pagamento) com `value: 0`, media o atraso por `updatedAt` (ignorando quem
 * está atrasado há mais de PAST_DUE_INACTIVE_AFTER_DAYS) e reenviava o
 * mesmo aviso a cada execução — sem dedupe. Agora: mede o atraso pela data
 * de vencimento efetiva (`resolveEffectiveNextDueDate`), usa template
 * próprio por degrau (`sendDelinquencyReminderEmail`) e deduplica via
 * timeline append-only (`SubscriptionChangeLog`, `eventType` reduced/cut +
 * `changeType` do lembrete) — um aviso por degrau por ciclo de atraso.
 */
export class OverdueReminderUseCase {
  async processOverdueReminders(): Promise<Output> {
    // O SQL já descarta a janela de tolerância (D0–D4): sem isso o `take`
    // era gasto em quem não recebe aviso nenhum.
    const notBefore = new Date(
      Date.now() - DELINQUENCY_CRM_ONLY_AFTER_DAYS * 24 * 60 * 60 * 1000,
    );

    const pastDue = await billingEngineRepository.findPastDueSubscriptionsForDunning({
      take: DUNNING_BATCH_SIZE,
      notBefore,
    });

    const emailService = createEmailService();
    const appUrl = getAppUrl({ removeTrailingSlash: true });
    let sent = 0;
    let failed = 0;
    let deduped = 0;
    let skipped = 0;
    let noticeLogFailed = 0;

    for (const row of pastDue) {
      const email = row.profile.email;
      const effectiveDueDate = resolveEffectiveNextDueDate(
        row.subscriptionNextDueDate,
        row.profile.subscriptionNextDueDate,
      );
      if (!email || !effectiveDueDate) {
        skipped += 1;
        continue;
      }

      const tier: DelinquencyTier = resolveDelinquencyTier({
        subscriptionStatus: "past_due",
        subscriptionNextDueDate: effectiveDueDate,
      });

      if (tier === "full_access") {
        // Ainda na tolerância pela data efetiva (o SQL filtra pela data da
        // ProfileSubscription; a do Profile pode ser mais nova).
        skipped += 1;
        continue;
      }

      const eventType = DELINQUENCY_EVENT_TYPE_BY_TIER[tier];

      try {
        const alreadyNotified = await billingEngineRepository.hasDelinquencyNoticeSince({
          profileId: row.profileId,
          eventType,
          changeType: DELINQUENCY_REMINDER_CHANGE_TYPE,
          since: effectiveDueDate,
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
          idempotencyKey: `delinquency:${row.profileId}:${tier}:${effectiveDueDate.toISOString()}`,
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

        // A marca de dedupe é gravada por um caminho que PROPAGA erro — se
        // ela falhasse em silêncio, o e-mail sairia de novo todo dia depois
        // das 24h de idempotência do provedor (DA5: falha de cobrança nunca
        // é engolida).
        try {
          await billingEngineRepository.recordDelinquencyNotice({
            profileId: row.profileId,
            eventType,
            changeType: DELINQUENCY_REMINDER_CHANGE_TYPE,
            source: DELINQUENCY_REMINDER_SOURCE,
            metadata: { tier, subscriptionNextDueDate: effectiveDueDate.toISOString() },
          });
        } catch (error) {
          noticeLogFailed += 1;
          console.error("[OverdueReminderUseCase] e-mail enviado SEM marca de dedupe", {
            profileId: row.profileId,
            tier,
            error,
          });
        }
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
      noticeLogFailed,
    });

    return new Output(true, ["Cron overdue-reminder executado"], [], {
      candidates: pastDue.length,
      sent,
      failed,
      deduped,
      skipped,
      noticeLogFailed,
    });
  }
}

export const overdueReminderUseCase = new OverdueReminderUseCase();
