import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Output } from "@/lib/output";
import { detectStudioWebhookPayloadSqlInjection } from "@/lib/webhooks/studioWebhookSecurity";
import { studioWebhookErrors, studioWebhookIntegrationUseCase } from "@/app/api/useCases/integrations/StudioWebhookIntegrationUseCase";
import { StudioWebhookLeadRequestSchema } from "./DTO/requestStudioWebhookLead";

const TeamIdSchema = z.string().uuid("teamId must be a valid UUID");
const TokenSchema = z.string().trim().min(1, "token is required");

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

type HandleStudioWebhookLeadRequestInput = {
  request: NextRequest;
  routePrefix: string;
  teamId: string;
  token?: string;
};

export const handleStudioWebhookLeadRequest = async ({
  request,
  routePrefix,
  teamId,
  token,
}: HandleStudioWebhookLeadRequestInput): Promise<NextResponse> => {
  try {
    const validatedTeamId = TeamIdSchema.safeParse(teamId);
    if (!validatedTeamId.success) {
      return NextResponse.json(
        new Output(
          false,
          [],
          validatedTeamId.error.issues.map((issue) => issue.message),
          null
        ),
        { status: 400 }
      );
    }

    if (typeof token === "string") {
      const validatedToken = TokenSchema.safeParse(token);
      if (!validatedToken.success) {
        return NextResponse.json(
          new Output(
            false,
            [],
            validatedToken.error.issues.map((issue) => issue.message),
            null
          ),
          { status: 400 }
        );
      }
    }

    const rawBody = await request.json().catch(() => null);
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
        teamId: validatedTeamId.data,
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
      teamId: validatedTeamId.data,
      token,
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
};
