import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Output } from "@/lib/output";
import {
  detectStudioWebhookPayloadSqlInjection,
  sanitizeStudioWebhookEndpointForLogs,
} from "@/lib/webhooks/studioWebhookSecurity";
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

type JsonParseResult = {
  payload: unknown;
  isValidJson: boolean;
};

const parseWebhookRequestBody = (rawBody: string): JsonParseResult => {
  if (!rawBody.trim()) {
    return {
      payload: { rawBody },
      isValidJson: false,
    };
  }

  try {
    return {
      payload: JSON.parse(rawBody),
      isValidJson: true,
    };
  } catch {
    return {
      payload: { rawBody },
      isValidJson: false,
    };
  }
};

export const handleStudioWebhookLeadRequest = async ({
  request,
  routePrefix,
  teamId,
  token,
}: HandleStudioWebhookLeadRequestInput): Promise<NextResponse> => {
  const method = request.method.toUpperCase();
  let logTeamId: string | null = null;
  let logEndpoint = request.nextUrl.pathname;
  let requestPayloadForLog: unknown = null;

  const respondWithLog = async ({
    statusCode,
    output,
    resultType,
    errorMessage,
  }: {
    statusCode: number;
    output: Output;
    resultType: "success" | "error";
    errorMessage?: string | null;
  }): Promise<NextResponse> => {
    if (logTeamId) {
      await studioWebhookIntegrationUseCase.registerWebhookRequestLog({
        teamId: logTeamId,
        method,
        endpoint: logEndpoint,
        statusCode,
        resultType,
        requestPayload: requestPayloadForLog,
        responsePayload: output,
        errorMessage: errorMessage ?? null,
      });
    }

    return NextResponse.json(output, { status: statusCode });
  };

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

    logTeamId = validatedTeamId.data;
    logEndpoint = sanitizeStudioWebhookEndpointForLogs(request.nextUrl.pathname, logTeamId);

    const rawBody = await request.text().catch(() => "");
    const parsedBody = parseWebhookRequestBody(rawBody);
    requestPayloadForLog = parsedBody.payload;

    if (typeof token === "string") {
      const validatedToken = TokenSchema.safeParse(token);
      if (!validatedToken.success) {
        const output = new Output(
          false,
          [],
          validatedToken.error.issues.map((issue) => issue.message),
          null
        );
        return respondWithLog({
          statusCode: 400,
          output,
          resultType: "error",
          errorMessage: output.errorMessages.join(", "),
        });
      }
    }

    if (!parsedBody.isValidJson || !parsedBody.payload || typeof parsedBody.payload !== "object") {
      const output = new Output(false, [], ["Invalid JSON payload"], null);
      return respondWithLog({
        statusCode: 400,
        output,
        resultType: "error",
        errorMessage: "Invalid JSON payload",
      });
    }

    const sqlInspection = detectStudioWebhookPayloadSqlInjection(parsedBody.payload);
    if (sqlInspection.suspicious) {
      console.warn(`${routePrefix} Conteúdo suspeito detectado`, {
        path: sqlInspection.path,
        rule: sqlInspection.rule,
        teamId: validatedTeamId.data,
      });

      const output = new Output(false, [], ["Invalid payload content"], null);
      return respondWithLog({
        statusCode: 400,
        output,
        resultType: "error",
        errorMessage: "Invalid payload content",
      });
    }

    const bodyValidation = StudioWebhookLeadRequestSchema.safeParse(parsedBody.payload);
    if (!bodyValidation.success) {
      const output = new Output(
        false,
        [],
        bodyValidation.error.issues.map((issue) => issue.message),
        null
      );
      return respondWithLog({
        statusCode: 400,
        output,
        resultType: "error",
        errorMessage: output.errorMessages.join(", "),
      });
    }

    const output = await studioWebhookIntegrationUseCase.processWebhookLead({
      teamId: validatedTeamId.data,
      token,
      payload: bodyValidation.data,
    });

    if (!output.isValid) {
      const statusCode = resolveErrorStatus(output);
      return respondWithLog({
        statusCode,
        output,
        resultType: "error",
        errorMessage: output.errorMessages.join(", "),
      });
    }

    return respondWithLog({
      statusCode: 201,
      output,
      resultType: "success",
      errorMessage: null,
    });
  } catch (error) {
    console.error(`${routePrefix} Erro ao processar webhook:`, error);
    const output = new Output(false, [], ["Internal server error"], null);

    return respondWithLog({
      statusCode: 500,
      output,
      resultType: "error",
      errorMessage: error instanceof Error ? error.message : "Internal server error",
    });
  }
};
