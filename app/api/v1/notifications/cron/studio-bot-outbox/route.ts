import { NextResponse, type NextRequest, connection } from "next/server";
import { Output } from "@/lib/output";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";
import { backofficeBotEventOutboxUseCase } from "@/app/api/useCases/backofficeBot/BackofficeBotEventOutboxUseCase";
import { alertStudioBotOutboxFailRate } from "@/lib/studio-bot/outbox-fail-rate-alert";
import { withCronAudit } from "@/app/api/lib/cron/withCronAudit";
import { getDefaultCronSlackCallback } from "@/app/api/lib/cron/cronSlackCallback";

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
        cronKey: "studio-bot-outbox",
        cronPath: "/api/v1/notifications/cron/studio-bot-outbox",
      },
      () => backofficeBotEventOutboxUseCase.dispatchPending(50),
      {
        onFailure: getDefaultCronSlackCallback(),
      }
    )
    
    const result = output.result as { dispatched?: number; failed?: number } | null;
    if (
      output.isValid &&
      result &&
      typeof result.dispatched === "number" &&
      typeof result.failed === "number"
    ) {
      alertStudioBotOutboxFailRate({
        dispatched: result.dispatched,
        failed: result.failed,
      });
    }

    return NextResponse.json(output, { status: output.isValid ? 200 : 500 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[StudioBotOutboxCronRoute][GET] Erro:", error);
    return NextResponse.json(
      new Output(false, [], ["Erro interno no cron de outbox Bethânia"], null),
      { status: 500 }
    );
  }
}
