import { NextResponse } from "next/server"
import * as Sentry from "@sentry/nextjs"
import { PaymentProviderError } from "@/lib/payment-provider/errors"
import { redactWebhookSecretInText } from "@/lib/observability/scrubWebhookSecret"
import { createPaymentProviderWebhookService } from "@/app/api/useCases/paymentProviderWebhook/paymentProviderWebhookComposition"

const LOG_TAG = "[POST /api/v1/webhooks/payment-provider/abacate] Error"

// O segredo viaja na query e pode aparecer em logs de infraestrutura: a resposta não pode
// ser cacheada nem entregar a URL como Referer, e a rota nunca redireciona.
const RESPONSE_HEADERS = { "Referrer-Policy": "no-referrer", "Cache-Control": "no-store" } as const

function respond(body: { accepted: boolean; action?: string }, status: number) {
  return NextResponse.json(body, { status, headers: RESPONSE_HEADERS })
}

function readEventId(rawBody: string): string | undefined {
  try {
    const parsed: unknown = JSON.parse(rawBody)
    const id = typeof parsed === "object" && parsed !== null ? (parsed as { id?: unknown }).id : undefined
    return typeof id === "string" ? id : undefined
  } catch {
    return undefined
  }
}

// Clientes HTTP e wrappers às vezes embutem a URL na mensagem do erro: nada disso sai daqui.
function toSafeError(error: unknown): Error {
  if (!(error instanceof Error)) return new Error("unknown")
  const message = redactWebhookSecretInText(error.message)
  if (message === error.message && !error.stack?.includes("webhookSecret=")) return error
  const safe = new Error(message)
  safe.name = error.name
  safe.stack = error.stack ? redactWebhookSecretInText(error.stack) : undefined
  return safe
}

// 401 (segredo ausente/errado, devMode em produção) é ruído de scanner e já fica no log
// estruturado; só falhas inesperadas (500) vão ao Sentry.
function reportUnexpectedFailure(error: Error, eventId: string | undefined): void {
  Sentry.captureException(error, {
    tags: { provider: "ABACATE_PAY" },
    extra: { eventId },
  })
}

export async function POST(request: Request) {
  let eventId: string | undefined
  try {
    const rawBody = await request.text()
    eventId = readEventId(rawBody)
    const composition = await createPaymentProviderWebhookService()
    const result = await composition.service.handle({
      externalAccountContext: composition.externalAccountContext,
      request: {
        rawBody,
        signature: request.headers.get("x-abacate-signature") ?? request.headers.get("x-signature"),
        query: { webhookSecret: new URL(request.url).searchParams.get("webhookSecret") },
      },
    })
    return respond({ accepted: true, action: result.action }, 202)
  } catch (error) {
    const safeError = toSafeError(error)
    console.error(LOG_TAG, { message: safeError.message })
    if (error instanceof PaymentProviderError && error.code === "WEBHOOK_INVALID") {
      return respond({ accepted: false }, 401)
    }
    reportUnexpectedFailure(safeError, eventId)
    return respond({ accepted: false }, 500)
  }
}
