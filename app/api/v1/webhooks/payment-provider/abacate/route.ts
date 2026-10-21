import * as Sentry from "@sentry/nextjs"
import { NextResponse } from "next/server"
import { PaymentProviderError } from "@/lib/payment-provider/errors"
import { redactSensitiveUrls } from "@/lib/payment-provider/operational-alerts"
import { createPaymentProviderWebhookService } from "@/app/api/useCases/paymentProviderWebhook/paymentProviderWebhookComposition"

const ROUTE_NAME = "POST /api/v1/webhooks/payment-provider/abacate"
const SECURE_HEADERS = { "Referrer-Policy": "no-referrer", "Cache-Control": "no-store" } as const

export async function POST(request: Request) {
  let rawBody = ""
  try {
    rawBody = await request.text()
    const composition = await createPaymentProviderWebhookService()
    const result = await composition.service.handle({
      externalAccountContext: composition.externalAccountContext,
      request: {
        rawBody,
        signature:
          request.headers.get("x-webhook-signature") ??
          request.headers.get("x-abacate-signature") ??
          request.headers.get("x-signature"),
        query: { webhookSecret: new URL(request.url).searchParams.get("webhookSecret") },
      },
    })
    return respond({ accepted: true, action: result.action }, 202)
  } catch (error) {
    const rejected = error instanceof PaymentProviderError && error.code === "WEBHOOK_INVALID"
    reportRouteError(error, rawBody, rejected)
    return respond({ accepted: false }, rejected ? 401 : 500)
  }
}

// Respostas diretas, sem redirecionamento, e sem Referer: a URL do webhook carrega o segredo.
function respond(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, { status, headers: SECURE_HEADERS })
}

// A URL (com o segredo na query) nunca entra no log nem no Sentry: a mensagem é higienizada
// e o evento é um Error novo, sem a cadeia `cause` do original.
function reportRouteError(error: unknown, rawBody: string, rejected: boolean): void {
  const message = redactSensitiveUrls(error instanceof Error ? error.message : "unknown")
  const eventId = readProviderEventId(rawBody)
  console.error(`[${ROUTE_NAME}] Error`, { message, eventId, rejected })
  if (rejected) return
  Sentry.captureException(new Error(message), {
    tags: { route: "PaymentProviderWebhook", provider: "ABACATE_PAY" },
    extra: { eventId },
  })
}

function readProviderEventId(rawBody: string): string | null {
  try {
    const parsed = JSON.parse(rawBody) as { id?: unknown }
    return typeof parsed.id === "string" ? parsed.id.slice(0, 120) : null
  } catch {
    return null
  }
}
