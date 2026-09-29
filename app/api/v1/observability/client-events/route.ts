import { NextResponse } from "next/server";
import { consumePublicFormRateLimit, publicFormRequestFingerprint } from "@/lib/public-forms/rate-limit";
import { createLogger } from "@/lib/observability/logger";
import { CLIENT_EVENT_LIMIT, parseClientEvent } from "@/lib/observability/client-events";

const logger = createLogger("client-events");
const MAX_BODY_BYTES = 8_192;

export async function POST(request: Request): Promise<Response> {
  const rateLimit = await consumePublicFormRateLimit(
    `observability:client:${publicFormRequestFingerprint(request)}`,
    CLIENT_EVENT_LIMIT,
  );
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { accepted: false },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
    );
  }

  const rawBody = await request.arrayBuffer().catch(() => null);
  if (!rawBody || rawBody.byteLength > MAX_BODY_BYTES) {
    return NextResponse.json({ accepted: false }, { status: 413 });
  }

  let body: unknown;
  try {
    body = JSON.parse(new TextDecoder().decode(rawBody)) as unknown;
  } catch {
    return NextResponse.json({ accepted: false }, { status: 400 });
  }
  const event = parseClientEvent(body);
  if (!event) return NextResponse.json({ accepted: false }, { status: 400 });

  logger[event.level](event.message, {
    source: "browser",
    route: event.route,
    requestId: event.requestId,
    ...(event.stack ? { stack: event.stack } : {}),
  });

  return NextResponse.json({ accepted: true }, { status: 202 });
}
