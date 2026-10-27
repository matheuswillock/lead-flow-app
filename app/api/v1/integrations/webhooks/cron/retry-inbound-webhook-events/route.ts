import { NextRequest, NextResponse, connection } from "next/server";
import { Output } from "@/lib/output";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";
import { withCronAudit } from "@/app/api/lib/cron/withCronAudit";
import { getDefaultCronSlackCallback } from "@/app/api/lib/cron/cronSlackCallback";
import { retryInboundWebhookEventsUseCase } from "@/app/api/useCases/integrations/webhooks/inbound/retryInboundWebhookEventsInstance";

export const maxDuration = 60;

const routePrefix = "[InboundWebhookEventsRetryCron]";

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(new Output(false, [], ["Não autorizado"], null), { status: 401 });
    }

    const output = await withCronAudit(
      {
        cronKey: "webhook-inbound-events-retry",
        cronPath: "/api/v1/integrations/webhooks/cron/retry-inbound-webhook-events",
      },
      () => retryInboundWebhookEventsUseCase.execute(),
      { onFailure: getDefaultCronSlackCallback() },
    );
    return NextResponse.json(output, { status: output.isValid ? 200 : 500 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error(`${routePrefix}[POST] Erro:`, error);
    return NextResponse.json(new Output(false, [], ["Erro interno no cron de eventos de webhook de entrada"], null), {
      status: 500,
    });
  }
}

export async function GET(request: NextRequest) {
  await connection();
  return POST(request);
}
