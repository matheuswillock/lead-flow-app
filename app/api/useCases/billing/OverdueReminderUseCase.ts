import { Output } from "@/lib/output";
import { createEmailService } from "@/lib/services/EmailService";
import { getAppUrl } from "@/lib/utils/app-url";
import { PAST_DUE_INACTIVE_AFTER_DAYS } from "@/lib/billing/asaas-subscription-status";
import { billingEngineRepository } from "@/app/api/infra/data/repositories/billing/BillingEngineRepository";

export class OverdueReminderUseCase {
  async processOverdueReminders(): Promise<Output> {
    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - PAST_DUE_INACTIVE_AFTER_DAYS);

    const pastDue = await billingEngineRepository.findPastDueSubscriptions({
      windowStart,
      take: 200,
    });

    const emailService = createEmailService();
    const appUrl = getAppUrl({ removeTrailingSlash: true });
    let sent = 0;
    let failed = 0;

    for (const row of pastDue) {
      const email = row.profile.email;
      if (!email) continue;
      const isFirstCharge = !row.subscriptionStartDate;
      try {
        const manageUrl = row.profile.supabaseId
          ? `${appUrl}/${row.profile.supabaseId}/subscription`
          : `${appUrl}/sign-in`;
        const res = await emailService.sendSubscriptionConfirmationEmail({
          userName: row.profile.fullName || email.split("@")[0],
          userEmail: email,
          subscriptionId: row.asaasSubscriptionId ?? undefined,
          planName: isFirstCharge
            ? "Lembrete: primeira cobrança em atraso"
            : "Lembrete: renovação em atraso",
          value: 0,
          manageUrl,
          timezone: row.profile.timezone,
        });
        if (!res.success) {
          failed += 1;
          console.error("[OverdueReminderUseCase] falha e-mail", {
            profileId: row.profileId,
            error: res.error,
          });
        } else {
          sent += 1;
        }
      } catch (error) {
        failed += 1;
        console.error("[OverdueReminderUseCase] erro", {
          profileId: row.profileId,
          error,
        });
      }
    }

    console.info("[OverdueReminderUseCase] done", {
      candidates: pastDue.length,
      sent,
      failed,
    });

    return new Output(true, ["Cron overdue-reminder executado"], [], {
      candidates: pastDue.length,
      sent,
      failed,
    });
  }
}

export const overdueReminderUseCase = new OverdueReminderUseCase();
