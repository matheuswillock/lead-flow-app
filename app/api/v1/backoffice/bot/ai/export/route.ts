import { NextResponse, type NextRequest, connection } from "next/server";
import { Output } from "@/lib/output";
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess";
import { backofficeBotAiMetricsUseCase } from "@/app/api/useCases/backofficeBotAi/BackofficeBotAiUseCases";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";

export async function GET(request: NextRequest) {
  await connection();

  try {
    const accessResult = await getBackofficeAccess(request);
    if (accessResult.error) {
      return NextResponse.json(accessResult.error, { status: accessResult.status });
    }
    const { searchParams } = new URL(request.url);
    const output = await backofficeBotAiMetricsUseCase.exportCsv(
      accessResult.access.fullAccess,
      searchParams.get("from"),
      searchParams.get("to")
    );
    if (!output.isValid) {
      return NextResponse.json(output, {
        status: output.errorMessages[0]?.includes("MASTER") ? 403 : 400,
      });
    }
    const csv = (output.result as { csv: string }).csv;
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="bethania-ai-usage.csv"',
      },
    });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[BackofficeBotAiExportRoute][GET]", error);
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 });
  }
}
