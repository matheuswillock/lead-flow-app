import { Output } from "@/lib/output";
import { createEmailService } from "@/lib/services/EmailService";
import { getAppUrl } from "@/lib/utils/app-url";
import {
  billingEngineRepository,
  type PastDueSubscriptionForDunningRow,
} from "@/app/api/infra/data/repositories/billing/BillingEngineRepository";
import { backofficeCronExecutionRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeCronExecution/BackofficeCronExecutionRepository";
import type { IBackofficeCronExecutionRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeCronExecution/IBackofficeCronExecutionRepository";
import type { EmailService } from "@/lib/services/EmailService";
import {
  DELINQUENCY_CRM_ONLY_AFTER_DAYS,
  resolveDelinquencyTier,
  resolveEffectiveNextDueDate,
  type DelinquencyTier,
} from "@/lib/billing/delinquency-tier";

/**
 * Chave deste cron no `BackofficeCronExecution` — MESMA usada pela rota
 * (`app/api/v1/billing/cron/overdue-reminder/route.ts`, `withCronAudit`).
 * Fonte única aqui para o `resolveStartCursor` (achado P1, thread
 * PRRT_...CUk5) nunca divergir da chave que a rota realmente audita.
 */
export const DUNNING_CRON_KEY = "overdue-reminder";

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
  constructor(
    private readonly cronExecutionRepository: IBackofficeCronExecutionRepository = backofficeCronExecutionRepository,
  ) {}

  /**
   * Achado P1 da revisão do PR #1207, 2ª rodada (chatgpt-codex-connector,
   * thread PRRT_...CUk5): sem cursor persistido, `skip` sempre começa em 0
   * e o teto de `DUNNING_MAX_SCAN` vira um prefixo ESTÁVEL — as mesmas
   * linhas mais antigas (já avisadas) são revisitadas todo dia, e quem está
   * depois da linha `DUNNING_MAX_SCAN` nunca é alcançado. Reaproveita o
   * `metadata` que `withCronAudit`/`markSuccess` já grava a cada execução
   * bem-sucedida (nenhuma tabela nova) — lê a última execução COM SUCESSO
   * deste cron e retoma de onde ela parou.
   */
  private async resolveStartCursor(): Promise<number> {
    try {
      const [lastSuccess] = await this.cronExecutionRepository.findMany({
        cronKey: DUNNING_CRON_KEY,
        status: "success",
        limit: 1,
      });
      const metadata = lastSuccess?.metadata as { nextDunningScanCursor?: unknown } | null | undefined;
      const cursor = metadata?.nextDunningScanCursor;
      return typeof cursor === "number" && Number.isFinite(cursor) && cursor > 0 ? cursor : 0;
    } catch (error) {
      console.error(
        "[OverdueReminderUseCase] falha ao resolver cursor persistido — reiniciando do zero",
        error,
      );
      return 0;
    }
  }

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
    const startCursor = await this.resolveStartCursor();
    let skip = startCursor;
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
        skip,
      });

      hasMorePages = page.length === DUNNING_PAGE_SIZE;

      // Achado P1 da 3ª rodada (thread PRRT_...YP_m): o cursor avança pelas
      // linhas efetivamente PROCESSADAS, não pela página inteira. Quando o
      // orçamento de e-mails corta a página no meio, avançar pelo
      // `page.length` cheio pularia as linhas restantes — elas só voltariam
      // a ser vistas depois de uma volta completa do cursor, que é
      // exatamente a inanição que o cursor veio resolver.
      let processedInPage = 0;
      for (const row of page) {
        if (totals.sent + totals.failed >= DUNNING_EMAIL_BUDGET) break;
        await this.processRow(row, context, totals);
        processedInPage += 1;
      }

      skip += processedInPage;
      scanned += processedInPage;
      totals.candidates += processedInPage;
    }

    // Achado P1 (thread PRRT_...CUk5): chegou ao fim de verdade (última
    // página veio incompleta) → fecha a volta e recomeça do zero amanhã.
    // Parou por teto/orçamento com mais páginas pela frente → continua
    // exatamente daqui na próxima execução, nunca relendo o mesmo prefixo.
    const nextDunningScanCursor = hasMorePages ? skip : 0;

    console.info("[OverdueReminderUseCase] done", { ...totals, scanned, nextDunningScanCursor });

    // Achado P1 (thread PRRT_...CUk6): quando o envio deu certo mas a marca
    // de dedupe não gravou, o run PRECISA sair inválido — senão
    // `withCronAudit` registra sucesso e nunca aciona o callback de falha
    // (Slack), e a idempotência do Resend (24h) deixa a porta aberta para
    // o mesmo e-mail de cobrança sair de novo amanhã sem ninguém saber que
    // a marca falhou.
    const hasUnrecordedNotices = totals.noticeLogFailed > 0;

    return new Output(
      !hasUnrecordedNotices,
      ["Cron overdue-reminder executado"],
      hasUnrecordedNotices
        ? [
            `${totals.noticeLogFailed} marca(s) de dedupe não gravada(s) após envio — ` +
              "e-mail pode ser reenviado nas próximas execuções (idempotência do Resend expira em 24h)",
          ]
        : [],
      { ...totals, scanned, nextDunningScanCursor },
    );
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
