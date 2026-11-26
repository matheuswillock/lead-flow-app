import { connection, NextResponse, type NextRequest } from "next/server";
import { Output } from "@/lib/output";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";
import { withCronAudit } from "@/app/api/lib/cron/withCronAudit";
import { getDefaultCronSlackCallback } from "@/app/api/lib/cron/cronSlackCallback";
import { createSubscriptionOverdueTransitionUseCase } from "@/app/api/useCases/providerRenewal/subscriptionOverdueTransitionComposition";

/**
 * Marca como `past_due` a conta paga pelo roteador cujo vencimento passou, para ela entrar na
 * carência e receber o aviso por e-mail. Roda antes do `overdue-reminder`.
 * GET /api/v1/billing/cron/subscription-overdue-transition
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
        cronKey: "subscription-overdue-transition",
        cronPath: "/api/v1/billing/cron/subscription-overdue-transition",
      },
      () => createSubscriptionOverdueTransitionUseCase().execute(new Date()),
      { onFailure: getDefaultCronSlackCallback() },
    );
    return NextResponse.json(output, { status: output.isValid ? 200 : 500 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[SubscriptionOverdueTransitionCron][GET] Erro:", error);
    return NextResponse.json(
      new Output(false, [], ["Erro interno no cron subscription-overdue-transition"], null),
      { status: 500 },
    );
  }
}
