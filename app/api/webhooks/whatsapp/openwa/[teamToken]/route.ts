import * as Sentry from "@sentry/nextjs"
import { after, NextRequest, NextResponse } from "next/server"
import { whatsAppRepository } from "@/app/api/infra/data/repositories/whatsapp/WhatsAppRepository"
import { verifyOpenWaHmac } from "@/lib/whatsapp/openwa-hmac"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"
import {
  recordWhatsAppWebhookProcessingFailure,
  recordWhatsAppWebhookProcessingSuccess,
} from "@/lib/whatsapp/whatsapp-webhook-failure-alert"
import { sanitizeWhatsAppWebhookPayload } from "@/lib/whatsapp/sanitize-webhook-payload"
import { processWhatsAppWebhookOutboxUseCase } from "@/app/api/useCases/whatsapp/ProcessWhatsAppWebhookOutboxUseCase"
import { Prisma } from "@prisma/client"

export const maxDuration = 60

function describeEvent(rawEvent: unknown): {
  eventType: string
  providerMessageId: string
  ack: number | null
} {
  const ev = rawEvent as Record<string, unknown>
  const data = ev?.["data"] as Record<string, unknown> | undefined
  const id = data?.["id"]
  const serialized =
    typeof id === "object" && id !== null
      ? (id as Record<string, unknown>)["_serialized"]
      : id
  const eventType = typeof ev?.["event"] === "string" ? (ev["event"] as string) : ""
  const providerMessageId = typeof serialized === "string" ? serialized : ""
  const ack =
    eventType === "message_ack" && typeof data?.["ack"] === "number" ? data["ack"] : null
  return { eventType, providerMessageId, ack }
}

function buildProviderEventId(
  eventType: string,
  providerMessageId: string,
  ack: number | null,
  fallbackEventId: string
): string {
  if (eventType === "message_ack" && providerMessageId && ack !== null) {
    return `${eventType}:${providerMessageId}:ack:${ack}`
  }
  return providerMessageId || `event:${eventType}:${fallbackEventId}`
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamToken: string }> }
) {
  const { teamToken } = await params
  const config = await whatsAppRepository.findConfigByWebhookSecret(teamToken)
  if (!config) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const rawBody = Buffer.from(await request.arrayBuffer())
  const signature = request.headers.get("x-openwa-signature")
  const secret = process.env.OPENWA_WEBHOOK_SECRET
  if (!secret || !verifyOpenWaHmac(secret, rawBody, signature)) {
    console.error(`[OpenWaWebhookRoute][POST] HMAC inválido — teamToken: ${teamToken}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let rawEvent: unknown
  try {
    rawEvent = JSON.parse(rawBody.toString("utf8"))
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { eventType, providerMessageId, ack } = describeEvent(rawEvent)

  try {
    const eventId = crypto.randomUUID()
    const persistedEventId = await whatsAppRepository.persistWebhookEvent({
      configId: config.id,
      teamId: config.teamId,
      providerEventId: buildProviderEventId(eventType, providerMessageId, ack, eventId),
      eventType: eventType || "openwa",
      payload: sanitizeWhatsAppWebhookPayload(rawEvent) as Prisma.InputJsonValue,
    })

    after(async () => {
      try {
        const output = await processWhatsAppWebhookOutboxUseCase.process(persistedEventId)
        if (!output.isValid) {
          const retryable = output.result?.retryable !== false
          if (!retryable) {
            console.info("[OpenWaWebhookRoute][after] evento não processável", {
              teamId: config.teamId,
              eventType,
              errors: output.errorMessages,
            })
            return
          }
          await recordWhatsAppWebhookProcessingFailure({
            configId: config.id,
            teamId: config.teamId,
            eventType,
            errors: output.errorMessages,
          })
          Sentry.captureMessage("[OpenWaWebhookRoute] processing failed", {
            level: "error",
            extra: { teamId: config.teamId, eventType, errors: output.errorMessages },
          })
          return
        }
        await recordWhatsAppWebhookProcessingSuccess(config.id)
      } catch (error) {
        rethrowIfPrerenderInterrupted(error)
        console.error("[OpenWaWebhookRoute][after]", error)
        Sentry.captureException(error)
      }
    })

    return NextResponse.json({ received: true }, { status: 200 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[OpenWaWebhookRoute][POST]", error)
    Sentry.captureException(error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
