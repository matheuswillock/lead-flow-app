import { NextResponse, type NextRequest } from "next/server";
import { Output } from "@/lib/output";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";
import { overdueReminderUseCase } from "@/app/api/useCases/billing/OverdueReminderUseCase";

/**
 * Estágio 12 — dunning: e-mail de lembrete para past_due.
 * GET /api/v1/billing/cron/overdue-reminder
 * Auth: Authorization: Bearer CRON_SECRET
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(new Output(false, [], ["Não autorizado"], null), { status: 401 });
    }

    const output = await overdueReminderUseCase.processOverdueReminders();
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
