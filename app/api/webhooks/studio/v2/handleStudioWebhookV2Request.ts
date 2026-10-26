import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { getClientIpFromRequest } from "@/lib/http/get-client-ip";
import { evaluateWebhookMetadataShape } from "@/lib/webhooks/studioWebhookSecurity";
import {
  buildInboundWebhookBadTokenKey,
  buildInboundWebhookIpKey,
  buildInboundWebhookTeamKey,
  checkInboundWebhookLayerRateLimit,
  consumeInboundRateLimit,
  INBOUND_WEBHOOK_RATE_LIMITS,
} from "@/lib/webhooks/inbound-rate-limit";
import { INBOUND_VERSION_MISMATCH_CODE } from "@/lib/webhooks/inbound/contractVersions";
import { inboundWebhookV2UseCase } from "@/app/api/useCases/integrations/webhooks/inbound/InboundWebhookV2UseCase";
import type { InboundV2AuthResult } from "@/app/api/useCases/integrations/webhooks/inbound/InboundWebhookV2UseCase";

const TeamIdSchema = z.string().uuid();

/** Mesmo teto da v1 (SPEC 10, DA2/DA3): 64 KiB, conferido antes de ler o corpo. */
const MAX_BODY_BYTES = 64 * 1024;
const MAX_PAYLOAD_DEPTH = 6;
const MAX_IDEMPOTENCY_KEY_LENGTH = 255;

type Deps = {
  useCase: Pick<typeof inboundWebhookV2UseCase, "authenticate" | "receive">;
  /** Agenda o processamento depois da resposta (`after()` em produção). */
  schedule: (task: () => Promise<void>) => void;
  process: (eventId: string) => Promise<void>;
};

const defaultDeps = (): Deps => ({
  useCase: inboundWebhookV2UseCase,
  schedule: (task) => after(task),
  process: async (eventId) => {
    // Import tardio: o recebimento não carrega o LeadUseCase; só o processamento carrega.
    const { processInboundWebhookEventById } = await import(
      "@/app/api/useCases/integrations/webhooks/inbound/processInboundWebhookEventById"
    );
    await processInboundWebhookEventById(eventId);
  },
});

const error = (status: number, code: string, message: string, headers?: Record<string, string>) =>
  NextResponse.json({ received: false, error: code, message }, { status, headers });

const tooManyRequests = (message: string, retryAfterSeconds: number) =>
  error(429, "rate_limited", message, { "Retry-After": String(Math.max(1, Math.ceil(retryAfterSeconds))) });

function parseBearerToken(request: NextRequest): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header);
  return match ? match[1] : null;
}

function resolveIdempotencyKey(request: NextRequest, payload: unknown): { key: string | null; invalid: boolean } {
  const header = request.headers.get("idempotency-key")?.trim();
  if (header !== undefined && header !== "") {
    return header.length > MAX_IDEMPOTENCY_KEY_LENGTH ? { key: null, invalid: true } : { key: header, invalid: false };
  }
  // Fallback do contrato: `external_id` do corpo.
  const externalId = (payload as { external_id?: unknown } | null)?.external_id;
  if (typeof externalId === "string" && externalId.trim() !== "") {
    const trimmed = externalId.trim();
    return trimmed.length > MAX_IDEMPOTENCY_KEY_LENGTH ? { key: null, invalid: true } : { key: trimmed, invalid: false };
  }
  return { key: null, invalid: false };
}

function respondToAuthFailure(auth: Exclude<InboundV2AuthResult, { status: "ok" }>): NextResponse {
  switch (auth.status) {
    case "token_expired":
      return error(401, "token_expired", "Token expirado.");
    case "version_mismatch":
      return error(
        400,
        INBOUND_VERSION_MISMATCH_CODE,
        "Este webhook não é da versão 2. Use a URL da versão configurada no webhook.",
      );
    case "forbidden":
      return auth.reason === "missing_scope"
        ? error(403, "missing_scope", "O token não tem permissão para criar leads.")
        : auth.reason === "account_restricted"
          ? error(403, "account_restricted", "O acesso desta conta está pausado.")
          : error(403, "webhook_inactive", "Webhook desativado ou pausado.");
    default:
      return error(401, "unauthorized", "Token ausente ou inválido.");
  }
}

/**
 * Webhook de entrada v2 (SPEC 11, DA4): fire and forget.
 *
 * Ordem (a mesma da v1, SPEC 10 DA2): limite por IP → time → tamanho → autenticação (token no header,
 * versão, escopo, conta) → limites por webhook e por time → corpo → idempotência → `202`.
 * O resultado do processamento NUNCA volta na resposta; fica nos logs do webhook no app.
 */
export async function handleStudioWebhookV2Request(
  request: NextRequest,
  teamIdParam: string,
  deps: Deps = defaultDeps(),
): Promise<NextResponse> {
  const ip = getClientIpFromRequest(request);

  const ipLimit = await consumeInboundRateLimit(buildInboundWebhookIpKey(ip), INBOUND_WEBHOOK_RATE_LIMITS.ip);
  if (!ipLimit.allowed) return tooManyRequests("Limite de requisições excedido.", ipLimit.retryAfterSeconds);

  const parsedTeamId = TeamIdSchema.safeParse(teamIdParam);
  if (!parsedTeamId.success) return error(400, "invalid_team", "Identificador de time inválido.");
  const teamId = parsedTeamId.data;

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return error(413, "payload_too_large", "Corpo grande demais.");
  }

  const token = parseBearerToken(request);
  if (!token) {
    const limit = await consumeInboundRateLimit(
      buildInboundWebhookBadTokenKey(teamId, ip),
      INBOUND_WEBHOOK_RATE_LIMITS.badToken,
    );
    if (!limit.allowed) return tooManyRequests("Limite de tentativas inválidas excedido.", limit.retryAfterSeconds);
    return error(401, "unauthorized", "Token ausente ou inválido.");
  }

  const auth = await deps.useCase.authenticate({ teamId, token });
  if (auth.status === "unauthorized") {
    const limit = await consumeInboundRateLimit(
      buildInboundWebhookBadTokenKey(teamId, ip),
      INBOUND_WEBHOOK_RATE_LIMITS.badToken,
    );
    if (!limit.allowed) return tooManyRequests("Limite de tentativas inválidas excedido.", limit.retryAfterSeconds);
    return respondToAuthFailure(auth);
  }
  if (auth.status !== "ok") return respondToAuthFailure(auth);

  const webhookLimit = await checkInboundWebhookLayerRateLimit(auth.webhook.id);
  if (!webhookLimit.allowed) return tooManyRequests("Limite de requisições do webhook excedido.", webhookLimit.retryAfterSeconds);
  const teamLimit = await consumeInboundRateLimit(buildInboundWebhookTeamKey(teamId), INBOUND_WEBHOOK_RATE_LIMITS.team);
  if (!teamLimit.allowed) return tooManyRequests("Limite de requisições do time excedido.", teamLimit.retryAfterSeconds);

  const rawBody = await request.text().catch(() => "");
  if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
    return error(413, "payload_too_large", "Corpo grande demais.");
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return error(400, "invalid_json", "O corpo precisa ser um JSON válido.");
  }
  // A validação de campos é assíncrona (202 mesmo com dado faltando); aqui só a forma, para o payload
  // gravado nunca estourar a pilha de quem o ler depois.
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return error(400, "invalid_json", "O corpo precisa ser um objeto JSON.");
  }
  const shape = evaluateWebhookMetadataShape(payload, { maxDepth: MAX_PAYLOAD_DEPTH, maxBytes: MAX_BODY_BYTES });
  if (!shape.ok) return error(400, "invalid_json", "O corpo tem estrutura inválida.");

  const idempotency = resolveIdempotencyKey(request, payload);
  if (idempotency.invalid) {
    return error(400, "invalid_idempotency_key", "A chave de idempotência pode ter no máximo 255 caracteres.");
  }

  const received = await deps.useCase.receive({
    webhook: auth.webhook,
    rawBody,
    payload: payload as Prisma.InputJsonValue,
    idempotencyKey: idempotency.key,
  });

  // Replay da mesma chave: devolve o mesmo event_id e não processa de novo.
  if (received.created) {
    deps.schedule(() => deps.process(received.eventId));
  }

  return NextResponse.json({ received: true, event_id: received.eventId }, { status: 202 });
}
