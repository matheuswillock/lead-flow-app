import { NextResponse, type NextRequest } from "next/server";
import { Output } from "@/lib/output";
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess";
import { backofficeBotAiMetricsUseCase } from "@/app/api/useCases/backofficeBotAi/BackofficeBotAiUseCases";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const accessResult = await getBackofficeAccess(request);
    if (accessResult.error) {
      return NextResponse.json(accessResult.error, { status: accessResult.status });
    }
    const { id } = await context.params;
    const output = await backofficeBotAiMetricsUseCase.interaction(id);
    return NextResponse.json(output, {
      status: output.isValid ? 200 : output.errorMessages[0]?.includes("não encontrada") ? 404 : 400,
    });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[BackofficeBotAiInteractionRoute][GET]", error);
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 });
  }
}
