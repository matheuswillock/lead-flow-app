import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Output } from "@/lib/output";
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess";
import { teamWebhookUseCase } from "@/app/api/useCases/integrations/webhooks/TeamWebhookUseCase";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";

const routePrefix = "[TeamWebhookStatusRoute]";

const BodySchema = z.union([
  z.object({ status: z.enum(["active", "disabled"]) }),
  z.object({ action: z.literal("reactivate") }),
]);

type RouteContext = { params: Promise<{ id: string }> };

const resolveAppUrl = (request: NextRequest): string => {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    return configured.endsWith("/") ? configured.slice(0, -1) : configured;
  }
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
};

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
    const rawBody = await request.json().catch(() => null);
    const validation = BodySchema.safeParse(rawBody);
    if (!validation.success) {
      return NextResponse.json(
        new Output(false, [], validation.error.issues.map((i) => i.message), null),
        { status: 400 }
      );
    }

    const output = await teamWebhookUseCase.changeStatus(
      accessResult.access,
      id,
      validation.data,
      resolveAppUrl(request)
    );

    return NextResponse.json(output, { status: output.isValid ? 200 : 400 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error(`${routePrefix}[POST] Erro:`, error);
    return NextResponse.json(new Output(false, [], ["Erro ao alterar status do webhook"], null), {
      status: 500,
    });
  }
}
