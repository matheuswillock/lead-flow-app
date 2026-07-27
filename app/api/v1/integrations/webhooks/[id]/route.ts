import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Output } from "@/lib/output";
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess";
import { teamWebhookUseCase } from "@/app/api/useCases/integrations/webhooks/TeamWebhookUseCase";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";

const routePrefix = "[TeamWebhookByIdRoute]";

const EventKeySchema = z.enum([
  "lead_created",
  "lead_status_changed",
  "lead_assigned",
  "appointment_created",
  "appointment_reminder",
  "activity_created",
]);

const PatchBodySchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  targetUrl: z.string().url().optional(),
  destinationPreset: z.enum(["generic", "slack", "teams", "zapier"]).optional(),
  selectedEvents: z.array(EventKeySchema).min(1).optional(),
  failureThreshold: z.number().int().min(1).max(100).optional(),
  tokenMode: z.enum(["manual", "auto", "none"]).optional(),
  manualToken: z
    .string()
    .min(8)
    .max(512)
    .regex(/^[A-Za-z0-9_-]+$/)
    .optional(),
  expiryMode: z.enum(["hours_24", "months_6", "indeterminate"]).optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

const resolveAppUrl = (request: NextRequest): string => {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    return configured.endsWith("/") ? configured.slice(0, -1) : configured;
  }
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
};

const requireManager = async (request: NextRequest) => {
  const accessResult = await getTeamAccess(request);
  if ("error" in accessResult) {
    return { errorResponse: NextResponse.json(accessResult.error, { status: accessResult.status }) };
  }
  if (accessResult.access.teamMember.role !== "manager") {
    return {
      errorResponse: NextResponse.json(
        new Output(false, [], ["Acesso negado. Apenas managers podem gerenciar webhooks."], null),
        { status: 403 }
      ),
    };
  }
  return { access: accessResult.access };
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireManager(request);
    if ("errorResponse" in auth) return auth.errorResponse;
    const { id } = await context.params;

    const output = await teamWebhookUseCase.getById(auth.access, id, resolveAppUrl(request));
    const status = output.isValid ? 200 : output.errorMessages.some((m) => m.includes("não encontrado")) ? 404 : 400;
    return NextResponse.json(output, { status });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error(`${routePrefix}[GET] Erro:`, error);
    return NextResponse.json(new Output(false, [], ["Erro ao carregar webhook"], null), { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireManager(request);
    if ("errorResponse" in auth) return auth.errorResponse;
    const { id } = await context.params;

    const rawBody = await request.json().catch(() => null);
    const validation = PatchBodySchema.safeParse(rawBody);
    if (!validation.success) {
      return NextResponse.json(
        new Output(false, [], validation.error.issues.map((i) => i.message), null),
        { status: 400 }
      );
    }

    const output = await teamWebhookUseCase.update(
      auth.access,
      id,
      validation.data,
      resolveAppUrl(request)
    );
    const status = output.isValid ? 200 : output.errorMessages.some((m) => m.includes("não encontrado")) ? 404 : 400;
    return NextResponse.json(output, { status });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error(`${routePrefix}[PATCH] Erro:`, error);
    return NextResponse.json(new Output(false, [], ["Erro ao atualizar webhook"], null), { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireManager(request);
    if ("errorResponse" in auth) return auth.errorResponse;
    const { id } = await context.params;

    const output = await teamWebhookUseCase.changeStatus(
      auth.access,
      id,
      { status: "disabled" },
      resolveAppUrl(request)
    );
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error(`${routePrefix}[DELETE] Erro:`, error);
    return NextResponse.json(new Output(false, [], ["Erro ao desativar webhook"], null), { status: 500 });
  }
}
