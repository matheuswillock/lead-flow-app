import { NextRequest, NextResponse } from "next/server";
import { getClientIpFromRequest } from "@/lib/http/get-client-ip";
import { consumeInboundRateLimit, INBOUND_WEBHOOK_RATE_LIMITS } from "@/lib/webhooks/inbound-rate-limit";
import type { AvailabilityApiResult } from "@/app/api/useCases/apiStudio/ApiStudioAvailabilityUseCase";
import type { Output } from "@/lib/output";

type Deps = {
  useCase: { execute(input: { token: string; date: string | null }): Promise<Output> };
};

const NO_STORE = { "Cache-Control": "no-store" } as const;

const error = (status: number, code: string, message: string, extra: Record<string, string> = {}) =>
  NextResponse.json({ error: code, message }, { status, headers: { ...NO_STORE, ...extra } });

const tooManyRequests = (message: string, retryAfterSeconds: number) =>
  error(429, "rate_limited", message, { "Retry-After": String(Math.max(1, Math.ceil(retryAfterSeconds))) });

function parseBearerToken(request: NextRequest): string | null {
  const header = request.headers.get("authorization");
  const match = header ? /^Bearer\s+(\S+)\s*$/i.exec(header) : null;
  return match ? match[1] : null;
}

/**
 * `GET /api/studio/v1/availability?date=AAAA-MM-DD` (SPEC 14, DA5). Chamada de servidor para servidor:
 * sem CORS, sem cache, token só no header. Ordem: limite por IP → token → (use case) ativação, feature,
 * conta, limite do token, data, cálculo.
 */
export async function handleAvailabilityRequest(request: NextRequest, deps: Deps): Promise<NextResponse> {
  const ip = getClientIpFromRequest(request);

  const ipLimit = await consumeInboundRateLimit(`api:ip:${ip}`, INBOUND_WEBHOOK_RATE_LIMITS.ip);
  if (!ipLimit.allowed) return tooManyRequests("Limite de requisições excedido.", ipLimit.retryAfterSeconds);

  const token = parseBearerToken(request);
  const registerBadToken = async (): Promise<NextResponse> => {
    const limit = await consumeInboundRateLimit(`api:badtoken:${ip}`, INBOUND_WEBHOOK_RATE_LIMITS.badToken);
    return limit.allowed
      ? error(401, "unauthorized", "Token ausente ou inválido.")
      : tooManyRequests("Limite de tentativas inválidas excedido.", limit.retryAfterSeconds);
  };
  if (!token) return registerBadToken();

  const output = await deps.useCase.execute({ token, date: request.nextUrl.searchParams.get("date") });
  const result = output.result as AvailabilityApiResult;

  if (result.kind === "ok") return NextResponse.json(result.body, { status: 200, headers: NO_STORE });
  if (result.code === "unauthorized") return registerBadToken();
  if (result.status === 429) return tooManyRequests(result.message, result.retryAfterSeconds ?? 60);
  return error(result.status, result.code, result.message);
}
