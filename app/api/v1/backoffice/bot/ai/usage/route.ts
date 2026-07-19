import { NextResponse, type NextRequest } from "next/server";
import { Output } from "@/lib/output";
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess";
import { backofficeBotAiMetricsUseCase } from "@/app/api/useCases/backofficeBotAi/BackofficeBotAiUseCases";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";

export async function GET(request: NextRequest) {
  try {
    const accessResult = await getBackofficeAccess(request);
    if (accessResult.error) {
      return NextResponse.json(accessResult.error, { status: accessResult.status });
    }
    const { searchParams } = new URL(request.url);
    const output = await backofficeBotAiMetricsUseCase.usage({
      from: searchParams.get("from"),
      to: searchParams.get("to"),
      page: Number(searchParams.get("page") ?? "1"),
      pageSize: Number(searchParams.get("pageSize") ?? "20"),
      provider: searchParams.get("provider"),
      model: searchParams.get("model"),
      status: searchParams.get("status"),
    });
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[BackofficeBotAiUsageRoute][GET]", error);
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 });
  }
}
