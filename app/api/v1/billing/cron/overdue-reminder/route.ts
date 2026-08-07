import { NextResponse, type NextRequest, connection } from "next/server";
import { Output } from "@/lib/output";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";
import { overdueReminderUseCase } from "@/app/api/useCases/billing/OverdueReminderUseCase";
import { withCronAudit } from "@/app/api/lib/cron/withCronAudit";
import { getDefaultCronSlackCallback } from "@/app/api/lib/cron/cronSlackCallback";

/**
 * Estágio 12 — dunning: e-mail de lembrete para past_due.
 * GET /api/v1/billing/cron/overdue-reminder
 * Auth: Authorization: Bearer CRON_SECRET
 */
export async function GET(request: NextRequest) {
  await connection();

  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(new Output(false, [], ["Não autorizado"], null), { status: 401 });
    }

    const output = await withCronAudit(
      {
        cronKey: "overdue-reminder",
        cronPath: "/api/v1/billing/cron/overdue-reminder",
      },
      () => overdueReminderUseCase.processOverdueReminders(),
      {
        onFailure: getDefaultCronSlackCallback(),
      }
    );
    return NextResponse.json(output, { status: output.isValid ? 200 : 500 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[OverdueReminderCron][GET] Erro:", error);
    return NextResponse.json(
      new Output(false, [], ["Erro interno no cron overdue-reminder"], null),
      { status: 500 }
    );
  }
}
