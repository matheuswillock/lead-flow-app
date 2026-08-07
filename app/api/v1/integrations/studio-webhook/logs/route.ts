import { NextRequest, NextResponse, connection } from "next/server";
import { Output } from "@/lib/output";
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess";
import { studioWebhookIntegrationUseCase } from "@/app/api/useCases/integrations/StudioWebhookIntegrationUseCase";
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';

const routePrefix = "[StudioWebhookLogsRoute]";

export async function GET(request: NextRequest) {
  await connection();

  try {
    const accessResult = await getTeamAccess(request);
    if ("error" in accessResult) {
      return NextResponse.json(accessResult.error, { status: accessResult.status });
    }

    if (accessResult.access.teamMember.role !== "manager") {
      return NextResponse.json(
        new Output(false, [], ["Acesso negado. Apenas managers podem visualizar os logs do webhook."], null),
        { status: 403 }
      );
    }

    const output = await studioWebhookIntegrationUseCase.getLatestWebhookLogs({
      teamId: accessResult.access.teamId,
      limit: 15,
    });

    if (!output.isValid) {
      const isNotFound = output.errorMessages.some((message) => message.toLowerCase().includes("não encontrado"));
      return NextResponse.json(output, { status: isNotFound ? 404 : 500 });
    }

    return NextResponse.json(output, { status: 200 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error(`${routePrefix}[GET] Erro ao consultar logs do webhook:`, error);
    return NextResponse.json(
      new Output(false, [], ["Erro ao consultar logs do webhook"], null),
      { status: 500 }
    );
  }
}
