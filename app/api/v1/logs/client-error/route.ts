import { NextRequest, NextResponse } from "next/server";
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';

const SENSITIVE_KEYS = new Set([
  "email",
  "name",
  "fullName",
  "operatorEmail",
  "managerEmail",
  "userEmail",
]);

const sanitizePayload = (payload: Record<string, unknown>) => {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (SENSITIVE_KEYS.has(key)) continue;
    if (key === "context" && value && typeof value === "object") {
      const contextValue = value as Record<string, unknown>;
      const sanitizedContext: Record<string, unknown> = {};
      for (const [contextKey, contextVal] of Object.entries(contextValue)) {
        if (SENSITIVE_KEYS.has(contextKey)) continue;
        sanitizedContext[contextKey] = contextVal;
      }
      sanitized.context = Object.keys(sanitizedContext).length ? sanitizedContext : undefined;
      continue;
    }
    sanitized[key] = value;
  }
  return sanitized;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const forwardedFor = request.headers.get("x-forwarded-for");
    const realIp = request.headers.get("x-real-ip");
    const userAgent = request.headers.get("user-agent");

    const payload = sanitizePayload({
      ...(body as Record<string, unknown>),
      ip: forwardedFor || realIp || undefined,
      serverUserAgent: userAgent || undefined,
      receivedAt: new Date().toISOString(),
    });

    console.error("[ClientError]", payload);

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[ClientError] Failed to process:", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
