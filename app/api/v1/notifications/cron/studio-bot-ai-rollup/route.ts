import { NextResponse, type NextRequest, connection } from "next/server";
import { Output } from "@/lib/output";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";
import { backofficeBotAiRollupUseCase } from "@/app/api/useCases/backofficeBotAi/BackofficeBotAiUseCases";

export async function GET(request: NextRequest) {
  await connection();

  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret =
      process.env.BACKOFFICE_BETHANIA_AI_ROLLUP_CRON_SECRET?.trim() ||
      process.env.CRON_SECRET?.trim();
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(new Output(false, [], ["Não autorizado"], null), { status: 401 });
    }

    const output = await backofficeBotAiRollupUseCase.run();
    return NextResponse.json(output, { status: output.isValid ? 200 : 500 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[StudioBotAiRollupCronRoute][GET]", error);
    return NextResponse.json(
      new Output(false, [], ["Erro interno no cron de rollup Bethânia IA"], null),
      { status: 500 }
    );
  }
}
