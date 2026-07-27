import { NextRequest, NextResponse } from "next/server";
import { Output } from "@/lib/output";
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess";
import { teamWebhookUseCase } from "@/app/api/useCases/integrations/webhooks/TeamWebhookUseCase";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";

const routePrefix = "[TeamWebhookTestRoute]";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
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
    const output = await teamWebhookUseCase.testDelivery(accessResult.access, id);
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error(`${routePrefix}[POST] Erro:`, error);
    return NextResponse.json(new Output(false, [], ["Erro no envio de teste"], null), { status: 500 });
  }
}
