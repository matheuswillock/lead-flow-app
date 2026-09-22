import { NextRequest, NextResponse } from "next/server";
import { Output } from "@/lib/output";
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess";
import { teamWebhookUseCase } from "@/app/api/useCases/integrations/webhooks/TeamWebhookUseCase";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";

const routePrefix = "[TeamWebhookSigningSecretRoute]";

type RouteContext = { params: Promise<{ id: string }> };

const resolveAppUrl = (request: NextRequest): string => {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    return configured.endsWith("/") ? configured.slice(0, -1) : configured;
  }
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
};

/** Rotaciona o segredo de assinatura HMAC do webhook de saída (DA1). O valor em texto puro só é devolvido nesta resposta. */
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
    const output = await teamWebhookUseCase.rotateSigningSecret(
      accessResult.access,
      id,
      resolveAppUrl(request)
    );
    const status = output.isValid
      ? 200
      : output.errorMessages.some((m) => m.includes("não encontrado"))
        ? 404
        : 400;
    return NextResponse.json(output, { status });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error(`${routePrefix}[POST] Erro:`, error);
    return NextResponse.json(
      new Output(false, [], ["Erro ao rotacionar segredo de assinatura"], null),
      { status: 500 }
    );
  }
}
