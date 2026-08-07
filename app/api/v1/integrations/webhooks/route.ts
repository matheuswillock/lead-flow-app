import { NextRequest, NextResponse, connection } from "next/server";
import { z } from "zod";
import { Output } from "@/lib/output";
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess";
import { teamWebhookUseCase } from "@/app/api/useCases/integrations/webhooks/TeamWebhookUseCase";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";

const routePrefix = "[TeamWebhookRoute]";

const DirectionSchema = z.enum(["inbound", "outbound"]);
const EventKeySchema = z.enum([
  "lead_created",
  "lead_status_changed",
  "lead_assigned",
  "appointment_created",
  "appointment_reminder",
  "activity_created",
]);

const CreateBodySchema = z
  .discriminatedUnion("direction", [
    z.object({
      direction: z.literal("inbound"),
      name: z.string().trim().min(1).max(120),
      tokenMode: z.enum(["manual", "auto", "none"]),
      manualToken: z
        .string()
        .min(8)
        .max(512)
        .regex(/^[A-Za-z0-9_-]+$/)
        .optional(),
      expiryMode: z.enum(["hours_24", "months_6", "indeterminate"]),
    }),
    z.object({
      direction: z.literal("outbound"),
      name: z.string().trim().min(1).max(120),
      targetUrl: z.string().url(),
      destinationPreset: z.enum(["generic", "slack", "teams", "zapier"]),
      selectedEvents: z.array(EventKeySchema).min(1),
      failureThreshold: z.number().int().min(1).max(100).optional(),
    }),
  ])
  .superRefine((value, ctx) => {
    if (value.direction === "inbound" && value.tokenMode === "manual") {
      const token = value.manualToken?.trim() ?? "";
      if (token.length < 8) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["manualToken"],
          message: "Token manual é obrigatório e deve ter ao menos 8 caracteres",
        });
      }
    }
  });

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

export async function GET(request: NextRequest) {
  await connection();

  try {
    const auth = await requireManager(request);
    if ("errorResponse" in auth) return auth.errorResponse;

    const { searchParams } = new URL(request.url);
    const directionParse = DirectionSchema.safeParse(searchParams.get("direction") ?? "inbound");
    if (!directionParse.success) {
      return NextResponse.json(
        new Output(false, [], ["direction deve ser inbound ou outbound"], null),
        { status: 400 }
      );
    }

    const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
    const pageSize = Math.min(50, Math.max(1, Number(searchParams.get("pageSize") ?? "20") || 20));
    const status = searchParams.get("status") as "active" | "paused" | "disabled" | null;
    const searchRaw = searchParams.get("search")?.trim() ?? "";
    const search = searchRaw.length > 0 ? searchRaw.slice(0, 120) : undefined;

    const output = await teamWebhookUseCase.list(
      auth.access,
      {
        direction: directionParse.data,
        status: status ?? undefined,
        search,
        page,
        pageSize,
      },
      resolveAppUrl(request)
    );

    return NextResponse.json(output, { status: output.isValid ? 200 : 400 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error(`${routePrefix}[GET] Erro:`, error);
    return NextResponse.json(
      new Output(false, [], ["Erro ao listar webhooks"], null),
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireManager(request);
    if ("errorResponse" in auth) return auth.errorResponse;

    const rawBody = await request.json().catch(() => null);
    const validation = CreateBodySchema.safeParse(rawBody);
    if (!validation.success) {
      return NextResponse.json(
        new Output(
          false,
          [],
          validation.error.issues.map((issue) => issue.message),
          null
        ),
        { status: 400 }
      );
    }

    const output = await teamWebhookUseCase.create(
      auth.access,
      validation.data,
      resolveAppUrl(request)
    );

    return NextResponse.json(output, { status: output.isValid ? 201 : 400 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error(`${routePrefix}[POST] Erro:`, error);
    return NextResponse.json(
      new Output(false, [], ["Erro ao criar webhook"], null),
      { status: 500 }
    );
  }
}
