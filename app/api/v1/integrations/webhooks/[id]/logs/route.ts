import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Output } from "@/lib/output";
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess";
import { teamWebhookUseCase } from "@/app/api/useCases/integrations/webhooks/TeamWebhookUseCase";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";

const routePrefix = "[TeamWebhookLogsRoute]";
const ResultSchema = z.enum(["success", "failure", "rejected"]);

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const accessResult = await getTeamAccess(request);
    if ("error" in accessResult) {
      return NextResponse.json(accessResult.error, { status: accessResult.status });
    }
    if (accessResult.access.teamMember.role !== "manager") {
      return NextResponse.json(
        new Output(false, [], ["Acesso negado. Apenas managers podem gerenciar webhooks."], null),
        { status: 403 }
      );
    }

    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
    const pageSize = Math.min(50, Math.max(1, Number(searchParams.get("pageSize") ?? "20") || 20));
    const resultRaw = searchParams.get("result");
    const resultParse = resultRaw ? ResultSchema.safeParse(resultRaw) : null;

    if (resultParse && !resultParse.success) {
      return NextResponse.json(
        new Output(false, [], ["result inválido"], null),
        { status: 400 }
      );
    }

    const output = await teamWebhookUseCase.listLogs(accessResult.access, id, {
      page,
      pageSize,
      result: resultParse?.success ? resultParse.data : undefined,
    });

    return NextResponse.json(output, { status: output.isValid ? 200 : 400 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error(`${routePrefix}[GET] Erro:`, error);
    return NextResponse.json(new Output(false, [], ["Erro ao carregar logs"], null), { status: 500 });
  }
}
