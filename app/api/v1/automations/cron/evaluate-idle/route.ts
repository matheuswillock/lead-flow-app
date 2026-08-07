import { NextResponse, type NextRequest, connection } from "next/server";
import { Output } from "@/lib/output";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";
import { evaluateIdleLeadsUseCase } from "@/app/api/useCases/teamAutomations/EvaluateIdleLeadsUseCase";
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
        cronKey: "evaluate-idle",
        cronPath: "/api/v1/automations/cron/evaluate-idle",
      },
      () => evaluateIdleLeadsUseCase.evaluate(),
      {
        onFailure: getDefaultCronSlackCallback(),
      }
    );
    return NextResponse.json(output, { status: output.isValid ? 200 : 500 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[AutomationEvaluateIdleCronRoute][GET] Erro:", error);
    return NextResponse.json(
      new Output(false, [], ["Erro interno no cron de automações"], null),
      { status: 500 }
    );
  }
}
