import { NextRequest, NextResponse, connection } from "next/server";
import { z } from "zod";
import { Output } from "@/lib/output";
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess";
import { studioWebhookIntegrationUseCase } from "@/app/api/useCases/integrations/StudioWebhookIntegrationUseCase";
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';

const routePrefix = "[StudioWebhookIntegrationRoute]";
const ExpiryModeSchema = z.enum(["hours_24", "months_6", "indeterminate"]);

const StudioWebhookConfigBodySchema = z
  .object({
    teamId: z.string().uuid().optional(),
    tokenMode: z.enum(["manual", "auto", "none"]),
    manualToken: z
      .string()
      .min(8, "Token manual deve ter ao menos 8 caracteres")
      .max(512)
      .regex(/^[A-Za-z0-9_-]+$/, "Token manual deve usar apenas letras, números, underscore ou hífen")
      .optional(),
    expiryMode: ExpiryModeSchema,
  })
  .superRefine((data, ctx) => {
    if (data.tokenMode === "manual" && !data.manualToken?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Token manual é obrigatório quando tokenMode=manual",
        path: ["manualToken"],
      });
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

export async function GET(request: NextRequest) {
  await connection();

  try {
    const accessResult = await getTeamAccess(request);
    if ("error" in accessResult) {
      return NextResponse.json(accessResult.error, { status: accessResult.status });
    }

    if (accessResult.access.teamMember.role !== "manager") {
      return NextResponse.json(
        new Output(false, [], ["Acesso negado. Apenas managers podem configurar o webhook."], null),
        { status: 403 }
      );
    }

    const output = await studioWebhookIntegrationUseCase.getConfiguration({
      teamId: accessResult.access.teamId,
      appUrl: resolveAppUrl(request),
    });

    if (!output.isValid) {
      const isNotFound = output.errorMessages.some((message) => message.toLowerCase().includes("não encontrado"));
      return NextResponse.json(output, { status: isNotFound ? 404 : 400 });
    }

    return NextResponse.json(output, { status: 200 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error(`${routePrefix}[GET] Erro ao consultar configuração do webhook:`, error);
    return NextResponse.json(
      new Output(false, [], ["Erro ao consultar configuração do webhook"], null),
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const accessResult = await getTeamAccess(request);
    if ("error" in accessResult) {
      return NextResponse.json(accessResult.error, { status: accessResult.status });
    }

    if (accessResult.access.teamMember.role !== "manager") {
      return NextResponse.json(
        new Output(false, [], ["Acesso negado. Apenas managers podem configurar o webhook."], null),
        { status: 403 }
      );
    }

    const rawBody = await request.json().catch(() => null);
    const validation = StudioWebhookConfigBodySchema.safeParse(rawBody);
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

    const targetTeamId = validation.data.teamId ?? accessResult.access.teamId;
    if (targetTeamId !== accessResult.access.teamId) {
      return NextResponse.json(
        new Output(false, [], ["Acesso negado para configurar webhook de outro time."], null),
        { status: 403 }
      );
    }

    const output = await studioWebhookIntegrationUseCase.upsertConfiguration({
      teamId: targetTeamId,
      updatedByProfileId: accessResult.access.profileId,
      tokenMode: validation.data.tokenMode,
      manualToken: validation.data.manualToken,
      expiryMode: validation.data.expiryMode,
      appUrl: resolveAppUrl(request),
    });

    if (!output.isValid) {
      return NextResponse.json(output, { status: 400 });
    }

    return NextResponse.json(output, { status: 200 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error(`${routePrefix}[PUT] Erro ao salvar configuração do webhook:`, error);
    return NextResponse.json(
      new Output(false, [], ["Erro ao salvar configuração do webhook"], null),
      { status: 500 }
    );
  }
}
