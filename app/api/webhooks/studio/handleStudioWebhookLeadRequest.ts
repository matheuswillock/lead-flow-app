import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Output } from "@/lib/output";
import { getClientIpFromRequest } from "@/lib/http/get-client-ip";
import {
  detectStudioWebhookPayloadSqlInjection,
  evaluateWebhookMetadataShape,
  sanitizeStudioWebhookEndpointForLogs,
} from "@/lib/webhooks/studioWebhookSecurity";
import {
  buildInboundWebhookBadTokenKey,
  buildInboundWebhookIpKey,
  buildInboundWebhookTeamKey,
  checkInboundWebhookLayerRateLimit,
  consumeInboundRateLimit,
  INBOUND_WEBHOOK_RATE_LIMITS,
} from "@/lib/webhooks/inbound-rate-limit";
import { studioWebhookErrors, studioWebhookIntegrationUseCase } from "@/app/api/useCases/integrations/StudioWebhookIntegrationUseCase";
import { StudioWebhookLeadRequestSchema } from "./DTO/requestStudioWebhookLead";

const TeamIdSchema = z.string().uuid("teamId must be a valid UUID");

/** V9/DA3: 64 KiB — antes de ler o corpo. */
const MAX_INBOUND_WEBHOOK_BODY_BYTES = 64 * 1024;

/**
 * R10-7 (revisão Opus, rodada 2): teto de profundidade do PAYLOAD INTEIRO,
 * não só de `metadata` (que tem seu próprio teto de 3, mais apertado, via
 * `evaluateWebhookMetadataShape` sem override). `metadata` pode ir até 3
 * níveis dentro de si mesma e ainda está aninhada 1 nível dentro do
 * payload — por isso o teto aqui precisa ser folgado o bastante para não
 * rejeitar um `metadata` legítimo no limite (payload -> metadata -> 3
 * níveis = profundidade 4), com margem.
 */
const MAX_INBOUND_WEBHOOK_PAYLOAD_DEPTH = 6;

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

  if (messages.includes(studioWebhookErrors.WEBHOOK_INACTIVE_ERROR)) {
    return 403;
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

const jsonWithRetryAfter = (output: Output, statusCode: number, retryAfterSeconds: number): NextResponse => {
  return NextResponse.json(output, {
    status: statusCode,
    headers: { "Retry-After": String(Math.max(1, Math.ceil(retryAfterSeconds))) },
  });
};

type AuthenticateInboundWebhookResult = {
  authenticated: boolean;
  webhookId: string | null;
  supabaseId: string | null;
  source: "team_webhook" | "legacy" | null;
};

/**
 * SPEC 10, A-E2 (DA2) — handler reordenado: limite por IP → tamanho →
 * autenticação → limites por token inválido/webhook/time → leitura e
 * validação do corpo → processamento. Uma requisição não autenticada nunca
 * grava linha em `TeamStudioWebhookRequestLog` e nunca recebe mensagem de
 * validação por campo — só 401 genérico (ou 429, se estourar o limitador).
 */
export const handleStudioWebhookLeadRequest = async ({
  request,
  routePrefix,
  teamId,
  token,
}: HandleStudioWebhookLeadRequestInput): Promise<NextResponse> => {
  const method = request.method.toUpperCase();
  const ip = getClientIpFromRequest(request);

  // 1) Limite por IP — antes de qualquer outra coisa, inclusive antes de
  // validar o formato do teamId (W31: tentativa com teamId malformado
  // também consome esse orçamento).
  const ipRateLimit = await consumeInboundRateLimit(buildInboundWebhookIpKey(ip), INBOUND_WEBHOOK_RATE_LIMITS.ip);
  if (!ipRateLimit.allowed) {
    return jsonWithRetryAfter(
      new Output(false, [], ["Limite de requisições excedido"], null),
      429,
      ipRateLimit.retryAfterSeconds
    );
  }

  // 2) teamId precisa ser um UUID válido. W31: mesmo malformado, gera log de
  // auditoria agregado (sem payload — o corpo ainda não foi lido).
  const validatedTeamId = TeamIdSchema.safeParse(teamId);
  if (!validatedTeamId.success) {
    // R10-16 (revisão Opus, sugestão): `rawTeamId` vinha sem truncar — um
    // path malformado propositalmente grande vira log grande, que também
    // sobe ao Sentry Logs via `consoleLoggingIntegration`.
    console.warn(`${routePrefix} teamId malformado`, { ip, rawTeamId: teamId.slice(0, 64) });
    return NextResponse.json(
      new Output(false, [], validatedTeamId.error.issues.map((issue) => issue.message), null),
      { status: 400 }
    );
  }
  const resolvedTeamId = validatedTeamId.data;

  // 3) Content-Length ≤ 64 KiB — antes de `request.text()`.
  const contentLengthHeader = request.headers.get("content-length");
  if (contentLengthHeader) {
    const contentLength = Number(contentLengthHeader);
    if (Number.isFinite(contentLength) && contentLength > MAX_INBOUND_WEBHOOK_BODY_BYTES) {
      return NextResponse.json(new Output(false, [], ["Payload too large"], null), { status: 413 });
    }
  }

  // 4) Resolução do webhook e autenticação — SEM ler o corpo.
  const authOutput = await studioWebhookIntegrationUseCase.authenticateInboundWebhook({
    teamId: resolvedTeamId,
    token,
  });
  const auth = authOutput.result as AuthenticateInboundWebhookResult;
  const identityResolved = auth.source !== null;

  if (!identityResolved) {
    // Token inválido/ausente sem nenhum candidato reconhecível: limite por
    // token inválido (por time+IP). Requisição não autenticada nunca grava
    // log e nunca recebe mensagem de validação por campo — só 401 genérico.
    const badTokenRateLimit = await consumeInboundRateLimit(
      buildInboundWebhookBadTokenKey(resolvedTeamId, ip),
      INBOUND_WEBHOOK_RATE_LIMITS.badToken
    );
    if (!badTokenRateLimit.allowed) {
      return jsonWithRetryAfter(
        new Output(false, [], ["Limite de tentativas inválidas excedido"], null),
        429,
        badTokenRateLimit.retryAfterSeconds
      );
    }

    return NextResponse.json(new Output(false, [], [studioWebhookErrors.UNAUTHORIZED_ERROR], null), {
      status: 401,
    });
  }

  // 5) Identidade resolvida (webhook ou legado). Limites por webhook e por
  // time — 429 aqui grava só em TeamWebhookEventLog (quando há webhookId),
  // nunca no log legado.
  const sanitizedEndpoint = sanitizeStudioWebhookEndpointForLogs(request.nextUrl.pathname, resolvedTeamId);

  if (auth.webhookId) {
    const webhookLayerRateLimit = await checkInboundWebhookLayerRateLimit(auth.webhookId);
    if (!webhookLayerRateLimit.allowed) {
      await studioWebhookIntegrationUseCase.registerWebhookRateLimitRejection({
        teamId: resolvedTeamId,
        webhookId: auth.webhookId,
        endpoint: sanitizedEndpoint,
      });
      return jsonWithRetryAfter(
        new Output(false, [], ["Limite de requisições do webhook excedido"], null),
        429,
        webhookLayerRateLimit.retryAfterSeconds
      );
    }
  }

  const teamRateLimit = await consumeInboundRateLimit(
    buildInboundWebhookTeamKey(resolvedTeamId),
    INBOUND_WEBHOOK_RATE_LIMITS.team
  );
  if (!teamRateLimit.allowed) {
    if (auth.webhookId) {
      await studioWebhookIntegrationUseCase.registerWebhookRateLimitRejection({
        teamId: resolvedTeamId,
        webhookId: auth.webhookId,
        endpoint: sanitizedEndpoint,
      });
    }
    return jsonWithRetryAfter(
      new Output(false, [], ["Limite de requisições do time excedido"], null),
      429,
      teamRateLimit.retryAfterSeconds
    );
  }

  const respondWithLog = async ({
    statusCode,
    output,
    resultType,
    errorMessage,
    requestPayload,
  }: {
    statusCode: number;
    output: Output;
    resultType: "success" | "error";
    errorMessage?: string | null;
    requestPayload: unknown;
  }): Promise<NextResponse> => {
    const resultWebhookId =
      output.result &&
      typeof output.result === "object" &&
      output.result !== null &&
      "webhookId" in output.result &&
      typeof (output.result as { webhookId?: unknown }).webhookId === "string"
        ? (output.result as { webhookId: string }).webhookId
        : auth.webhookId;

    await studioWebhookIntegrationUseCase.registerWebhookRequestLog({
      teamId: resolvedTeamId,
      method,
      endpoint: sanitizedEndpoint,
      statusCode,
      resultType,
      requestPayload,
      responsePayload: output,
      errorMessage: errorMessage ?? null,
      webhookId: resultWebhookId,
      token: token ?? null,
    });

    return NextResponse.json(output, { status: statusCode });
  };

  // 6) Identidade resolvida mas bloqueada por outro motivo (expirado,
  // pausado/desativado, master sem supabaseId) — já pode logar com detalhe,
  // porque quem chegou aqui já provou possuir o token certo.
  if (!auth.authenticated) {
    const rawBody = await request.text().catch(() => "");
    const parsedBody = parseWebhookRequestBody(rawBody);
    const statusCode = resolveErrorStatus(authOutput);
    return respondWithLog({
      statusCode,
      output: authOutput,
      resultType: "error",
      errorMessage: authOutput.errorMessages.join(", "),
      requestPayload: parsedBody.payload,
    });
  }

  // 7) Leitura e validação do corpo — só depois de autenticado.
  try {
    const rawBody = await request.text().catch(() => "");
    const parsedBody = parseWebhookRequestBody(rawBody);

    if (!parsedBody.isValidJson || !parsedBody.payload || typeof parsedBody.payload !== "object") {
      const output = new Output(false, [], ["Invalid JSON payload"], null);
      return respondWithLog({
        statusCode: 400,
        output,
        resultType: "error",
        errorMessage: "Invalid JSON payload",
        requestPayload: parsedBody.payload,
      });
    }

    // R10-7 (revisão Opus, Protocolo 96, rodada 2): o guard de profundidade
    // original só olhava `metadata`. O scanner de SQLi (recursão de
    // verdade) roda no PAYLOAD INTEIRO antes do `.strict()` do zod — uma
    // chave desconhecida com array aninhado profundo (mais barato em bytes
    // que objeto: ~2 bytes/nível) cabe ~32.000 níveis em 64KB e estoura a
    // pilha no runtime de produção (Node/Vercel), virando 500 em vez de 400
    // controlado. Medido pelo revisor: Node quebra já em ~5.900 níveis.
    // Corrigido aplicando o teto de profundidade ao payload inteiro, não só
    // a `metadata`, ANTES do scan.
    // R10-18 (revisão Opus, Protocolo 96, rodada 3): sem `maxBytes`
    // explícito aqui, `evaluateWebhookMetadataShape` caía no default de
    // `metadata` (8 KiB — DA6), aplicado por engano ao PAYLOAD INTEIRO, que
    // pela SPEC vai até 64 KiB (DA2/T-10.7). Isso derrubava com 400
    // qualquer webhook autenticado e válido entre 8 KiB e 64 KiB.
    const payloadShape = evaluateWebhookMetadataShape(parsedBody.payload, {
      maxDepth: MAX_INBOUND_WEBHOOK_PAYLOAD_DEPTH,
      maxBytes: MAX_INBOUND_WEBHOOK_BODY_BYTES,
    });
    if (!payloadShape.ok) {
      const output = new Output(false, [], ["Invalid payload content"], null);
      return respondWithLog({
        statusCode: 400,
        output,
        resultType: "error",
        errorMessage: `payload inválido: ${payloadShape.reason}`,
        requestPayload: parsedBody.payload,
      });
    }

    const metadataCandidate = (parsedBody.payload as Record<string, unknown>).metadata;
    const metadataShape = evaluateWebhookMetadataShape(metadataCandidate);
    if (!metadataShape.ok) {
      const output = new Output(false, [], ["Invalid payload content"], null);
      return respondWithLog({
        statusCode: 400,
        output,
        resultType: "error",
        errorMessage: `metadata inválido: ${metadataShape.reason}`,
        requestPayload: parsedBody.payload,
      });
    }

    const sqlInspection = detectStudioWebhookPayloadSqlInjection(parsedBody.payload);
    if (sqlInspection.suspicious) {
      console.warn(`${routePrefix} Conteúdo suspeito detectado`, {
        path: sqlInspection.path,
        rule: sqlInspection.rule,
        teamId: resolvedTeamId,
      });

      const output = new Output(false, [], ["Invalid payload content"], null);
      return respondWithLog({
        statusCode: 400,
        output,
        resultType: "error",
        errorMessage: "Invalid payload content",
        requestPayload: parsedBody.payload,
      });
    }

    const bodyValidation = StudioWebhookLeadRequestSchema.safeParse(parsedBody.payload);
    if (!bodyValidation.success) {
      const output = new Output(false, [], bodyValidation.error.issues.map((issue) => issue.message), null);
      return respondWithLog({
        statusCode: 400,
        output,
        resultType: "error",
        errorMessage: output.errorMessages.join(", "),
        requestPayload: parsedBody.payload,
      });
    }

    // 8) Processamento.
    const output = await studioWebhookIntegrationUseCase.processWebhookLead({
      teamId: resolvedTeamId,
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
        requestPayload: parsedBody.payload,
      });
    }

    return respondWithLog({
      statusCode: 201,
      output,
      resultType: "success",
      errorMessage: null,
      requestPayload: parsedBody.payload,
    });
  } catch (error) {
    console.error(`${routePrefix} Erro ao processar webhook:`, error);
    const output = new Output(false, [], ["Internal server error"], null);

    return respondWithLog({
      statusCode: 500,
      output,
      resultType: "error",
      errorMessage: error instanceof Error ? error.message : "Internal server error",
      requestPayload: null,
    });
  }
};
