import { Output } from "@/lib/output";
import { createEmailService } from "@/lib/services/EmailService";
import { getAppUrl } from "@/lib/utils/app-url";
import {
  billingEngineRepository,
  type PastDueSubscriptionForDunningRow,
} from "@/app/api/infra/data/repositories/billing/BillingEngineRepository";
import type { EmailService } from "@/lib/services/EmailService";
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

/** Linhas lidas por página do banco. */
const DUNNING_PAGE_SIZE = 200;
/** Teto de e-mails (enviados + falhos) por execução do cron. */
const DUNNING_EMAIL_BUDGET = 200;
/** Teto de linhas varridas por execução — o cron não vira scan sem fim. */
const DUNNING_MAX_SCAN = 2000;

type DunningRunContext = {
  emailService: EmailService;
  appUrl: string;
};

type DunningRunTotals = {
  candidates: number;
  sent: number;
  failed: number;
  deduped: number;
  skipped: number;
  noticeLogFailed: number;
};

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

    const context: DunningRunContext = {
      emailService: createEmailService(),
      appUrl: getAppUrl({ removeTrailingSlash: true }),
    };
    const totals: DunningRunTotals = {
      candidates: 0,
      sent: 0,
      failed: 0,
      deduped: 0,
      skipped: 0,
      noticeLogFailed: 0,
    };

    // Achado P1 da revisão do lote unificado (PR #1207): o dedupe acontece
    // por linha, depois da query, então um `take` fixo fazia as mesmas linhas
    // mais antigas — todas já avisadas — ocuparem o lote todo dia, e quem
    // entrou em atraso depois nunca receber aviso nenhum. O lote agora é
    // orçamento de **e-mails**, não de linhas lidas: paginamos por cima dos
    // já avisados até gastar o orçamento, com teto de varredura para o cron
    // não virar scan sem fim.
    let scanned = 0;
    let hasMorePages = true;

    while (
      hasMorePages &&
      totals.sent + totals.failed < DUNNING_EMAIL_BUDGET &&
      scanned < DUNNING_MAX_SCAN
    ) {
      const page = await billingEngineRepository.findPastDueSubscriptionsForDunning({
        take: DUNNING_PAGE_SIZE,
        notBefore,
        skip: scanned,
      });

      hasMorePages = page.length === DUNNING_PAGE_SIZE;
      scanned += page.length;
      totals.candidates += page.length;

      for (const row of page) {
        if (totals.sent + totals.failed >= DUNNING_EMAIL_BUDGET) break;
        await this.processRow(row, context, totals);
      }
    }

    console.info("[OverdueReminderUseCase] done", { ...totals, scanned });

    return new Output(true, ["Cron overdue-reminder executado"], [], { ...totals, scanned });
  }

  /** Um inadimplente: resolve o degrau, deduplica, envia e registra a marca. */
  private async processRow(
    row: PastDueSubscriptionForDunningRow,
    context: DunningRunContext,
    totals: DunningRunTotals,
  ): Promise<void> {
    const email = row.profile.email;
    const effectiveDueDate = resolveEffectiveNextDueDate(
      row.subscriptionNextDueDate,
      row.profile.subscriptionNextDueDate,
    );
    if (!email || !effectiveDueDate) {
      totals.skipped += 1;
      return;
    }

    const tier: DelinquencyTier = resolveDelinquencyTier({
      subscriptionStatus: "past_due",
      subscriptionNextDueDate: effectiveDueDate,
    });

    if (tier === "full_access") {
      // Ainda na tolerância pela data efetiva (o SQL filtra pela data da
      // ProfileSubscription; a do Profile pode ser mais nova).
      totals.skipped += 1;
      return;
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
        totals.deduped += 1;
        return;
      }

      const manageUrl = row.profile.supabaseId
        ? `${context.appUrl}/${row.profile.supabaseId}/subscription`
        : `${context.appUrl}/sign-in`;

      const res = await context.emailService.sendDelinquencyReminderEmail({
        userName: row.profile.fullName || email.split("@")[0],
        userEmail: email,
        tier,
        manageUrl,
        idempotencyKey: `delinquency:${row.profileId}:${tier}:${effectiveDueDate.toISOString()}`,
      });

      if (!res.success) {
        totals.failed += 1;
        console.error("[OverdueReminderUseCase] falha e-mail", {
          profileId: row.profileId,
          tier,
          error: res.error,
        });
        return;
      }

      totals.sent += 1;

      // A marca de dedupe é gravada por um caminho que PROPAGA erro — se ela
      // falhasse em silêncio, o e-mail sairia de novo todo dia depois das 24h
      // de idempotência do provedor (DA5: falha de cobrança nunca é engolida).
      try {
        await billingEngineRepository.recordDelinquencyNotice({
          profileId: row.profileId,
          eventType,
          changeType: DELINQUENCY_REMINDER_CHANGE_TYPE,
          source: DELINQUENCY_REMINDER_SOURCE,
          metadata: { tier, subscriptionNextDueDate: effectiveDueDate.toISOString() },
        });
      } catch (error) {
        totals.noticeLogFailed += 1;
        console.error("[OverdueReminderUseCase] e-mail enviado SEM marca de dedupe", {
          profileId: row.profileId,
          tier,
          error,
        });
      }
    } catch (error) {
      totals.failed += 1;
      console.error("[OverdueReminderUseCase] erro", {
        profileId: row.profileId,
        tier,
        error,
      });
    }
  }
}

export const overdueReminderUseCase = new OverdueReminderUseCase();
