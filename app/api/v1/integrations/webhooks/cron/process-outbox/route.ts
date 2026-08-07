import { NextRequest, NextResponse, connection } from "next/server";
import { Output } from "@/lib/output";
import { processWebhookOutboxUseCase } from "@/app/api/useCases/integrations/webhooks/ProcessWebhookOutboxUseCase";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";

const routePrefix = "[TeamWebhookOutboxCron]";

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(new Output(false, [], ["Não autorizado"], null), { status: 401 });
    }

    const output = await processWebhookOutboxUseCase.execute();
    return NextResponse.json(output, { status: output.isValid ? 200 : 500 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error(`${routePrefix}[POST] Erro:`, error);
    return NextResponse.json(
      new Output(false, [], ["Erro interno no cron de webhooks"], null),
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  await connection();

  return POST(request);
}
