import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Output } from "@/lib/output";
import { detectStudioWebhookPayloadSqlInjection } from "@/lib/webhooks/studioWebhookSecurity";
import { studioWebhookErrors, studioWebhookIntegrationUseCase } from "@/app/api/useCases/integrations/StudioWebhookIntegrationUseCase";
import { StudioWebhookLeadRequestSchema } from "./DTO/requestStudioWebhookLead";

const routePrefix = "[StudioWebhookRoute][POST]";

const ParamsSchema = z.object({
  teamId: z.string().uuid("teamId must be a valid UUID"),
  token: z.string().min(1, "token is required"),
});

const resolveErrorStatus = (output: Output): number => {
  const messages = output.errorMessages.join(" ");
  const normalized = messages.toLowerCase();

  if (
    messages.includes(studioWebhookErrors.UNAUTHORIZED_ERROR) ||
    messages.includes(studioWebhookErrors.TOKEN_EXPIRED_ERROR) ||
    normalized.includes("não autorizado")
  ) {
    return 401;
  }

  if (normalized.includes("já existe um lead")) {
    return 409;
  }

  if (normalized.includes("erro interno")) {
    return 500;
  }

  return 400;
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; token: string }> }
) {
  try {
    console.info(`${routePrefix} Recebendo webhook...`);
    console.info(`${routePrefix} Validando parâmetros...`, { params: await params });
    console.info(`${routePrefix} Validando payload...`);
    console.info(`${routePrefix} Verificando possíveis injeções de SQL no payload...`);


    const resolvedParams = await params;
    const paramsValidation = ParamsSchema.safeParse(resolvedParams);
    if (!paramsValidation.success) {
      return NextResponse.json(
        new Output(
          false,
          [],
          paramsValidation.error.issues.map((issue) => issue.message),
          null
        ),
        { status: 400 }
      );
    }

    const rawBody = await request.json().catch(() => null);
    console.info(`${routePrefix} Payload recebido:`, rawBody);

    if (!rawBody || typeof rawBody !== "object") {
      return NextResponse.json(
        new Output(false, [], ["Invalid JSON payload"], null),
        { status: 400 }
      );
    }

    const sqlInspection = detectStudioWebhookPayloadSqlInjection(rawBody);
    if (sqlInspection.suspicious) {
      console.warn(`${routePrefix} Conteúdo suspeito detectado`, {
        path: sqlInspection.path,
        rule: sqlInspection.rule,
        teamId: paramsValidation.data.teamId,
      });
      return NextResponse.json(
        new Output(false, [], ["Invalid payload content"], null),
        { status: 400 }
      );
    }

    const bodyValidation = StudioWebhookLeadRequestSchema.safeParse(rawBody);
    if (!bodyValidation.success) {
      return NextResponse.json(
        new Output(
          false,
          [],
          bodyValidation.error.issues.map((issue) => issue.message),
          null
        ),
        { status: 400 }
      );
    }

    const output = await studioWebhookIntegrationUseCase.processWebhookLead({
      teamId: paramsValidation.data.teamId,
      token: paramsValidation.data.token,
      payload: bodyValidation.data,
    });

    if (!output.isValid) {
      return NextResponse.json(output, { status: resolveErrorStatus(output) });
    }

    return NextResponse.json(output, { status: 201 });
  } catch (error) {
    console.error(`${routePrefix} Erro ao processar webhook:`, error);
    return NextResponse.json(
      new Output(false, [], ["Internal server error"], null),
      { status: 500 }
    );
  }
}
