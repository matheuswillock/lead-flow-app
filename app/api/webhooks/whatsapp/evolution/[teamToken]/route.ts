import * as Sentry from "@sentry/nextjs"
import { NextRequest, NextResponse } from "next/server"
import { whatsAppRepository } from "@/app/api/infra/data/repositories/whatsapp/WhatsAppRepository"
import { isValidEvoWebhookPayload } from "@/lib/whatsapp/webhook-signature"
import {
  deriveWebhookHeaderSecret,
  isValidWebhookHeaderSecret,
  isWebhookHeaderEnforcementEnabled,
  readWebhookHeaderSecret,
} from "@/lib/whatsapp/webhook-header-auth"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"
import {
  recordWhatsAppWebhookProcessingFailure,
  recordWhatsAppWebhookProcessingSuccess,
} from "@/lib/whatsapp/whatsapp-webhook-failure-alert"
import { prisma } from "@/app/api/infra/data/prisma"
import { sanitizeWhatsAppWebhookPayload } from "@/lib/whatsapp/sanitize-webhook-payload"
import { processWhatsAppWebhookOutboxUseCase } from "@/app/api/useCases/whatsapp/ProcessWhatsAppWebhookOutboxUseCase"
import { Prisma } from "@prisma/client"

export const maxDuration = 60

function describeEvent(rawEvent: unknown): { eventType: string; providerMessageId: string } {
  const ev = rawEvent as Record<string, unknown>
  const data = ev?.["data"] as Record<string, unknown> | undefined
  const key = data?.["key"] as Record<string, unknown> | undefined
  return {
    eventType: typeof ev?.["event"] === "string" ? (ev["event"] as string) : "",
    providerMessageId: typeof key?.["id"] === "string" ? (key["id"] as string) : "",
  }
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

  const expectedHeaderSecret = deriveWebhookHeaderSecret(config.webhookSecret)
  const providedHeaderSecret = readWebhookHeaderSecret(request)
  const headerValid = isValidWebhookHeaderSecret(providedHeaderSecret, expectedHeaderSecret)

  if (providedHeaderSecret && !headerValid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!headerValid) {
    if (isWebhookHeaderEnforcementEnabled()) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    console.warn("[WhatsAppEvoWebhookRoute][POST] Webhook header ausente (rollout legado via URL secret)")
  }

  let rawEvent: unknown
  try {
    rawEvent = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  if (!isValidEvoWebhookPayload(rawEvent)) {
    return NextResponse.json({ error: "Invalid payload structure" }, { status: 400 })
  }

  const { eventType, providerMessageId } = describeEvent(rawEvent)

  try {
    const eventId = crypto.randomUUID()
    const durableProviderEventId = providerMessageId || `event:${eventType}:${eventId}`
    const persisted = await prisma.$queryRaw<Array<{ id: string }>>`
      insert into whatsapp_webhook_events (id, "configId", "teamId", "providerEventId", "eventType", payload, status, "createdAt", "updatedAt")
      values (${eventId}::uuid, ${config.id}::uuid, ${config.teamId}::uuid, ${durableProviderEventId}, ${eventType}, ${sanitizeWhatsAppWebhookPayload(rawEvent) as Prisma.InputJsonValue}, 'PENDING', now(), now())
      on conflict ("configId", "providerEventId") do update set "updatedAt" = now()
      returning id
    `
    const output = await processWhatsAppWebhookOutboxUseCase.process(persisted[0]!.id)

    if (!output.isValid) {
      const retryable = output.result?.retryable !== false
      if (!retryable) {
        return NextResponse.json({ processed: false, errors: output.errorMessages }, { status: 200 })
      }
      await recordWhatsAppWebhookProcessingFailure({
        configId: config.id,
        teamId: config.teamId,
        eventType,
        errors: output.errorMessages,
      })
      Sentry.captureMessage("[WhatsAppEvoWebhookRoute] processing failed", {
        level: "error",
        tags: { route: "WhatsAppEvoWebhookRoute", phase: "process" },
        extra: { teamId: config.teamId, eventType, providerMessageId, errors: output.errorMessages },
      })
      return NextResponse.json({ error: "Processing failed", errors: output.errorMessages }, { status: 500 })
    }

    await recordWhatsAppWebhookProcessingSuccess(config.id)

    return NextResponse.json({ processed: true }, { status: 200 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    await recordWhatsAppWebhookProcessingFailure({
      configId: config.id,
      teamId: config.teamId,
      eventType,
      cause: error instanceof Error ? error.message : "unknown",
    }).catch((recordError) => {
      console.error("[WhatsAppEvoWebhookRoute][POST] Falha ao registrar streak de webhook", recordError)
    })
    Sentry.captureException(error, {
      tags: { route: "WhatsAppEvoWebhookRoute", phase: "process" },
      extra: { teamId: config.teamId, eventType, providerMessageId },
    })
    return NextResponse.json({ error: "Processing failed" }, { status: 500 })
  }
}
