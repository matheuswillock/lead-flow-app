import * as Sentry from "@sentry/nextjs"
import { after, NextRequest, NextResponse } from "next/server"
import { whatsAppRepository } from "@/app/api/infra/data/repositories/whatsapp/WhatsAppRepository"
import { processEvoWebhookUseCase } from "@/app/api/useCases/whatsapp/ProcessEvoWebhookUseCase"
import { isValidEvoWebhookPayload } from "@/lib/whatsapp/webhook-signature"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"

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

  let rawEvent: unknown
  try {
    rawEvent = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  if (!isValidEvoWebhookPayload(rawEvent)) {
    console.error("[WhatsAppEvoWebhookRoute][POST] Invalid payload structure")
    return NextResponse.json({ error: "Invalid payload structure" }, { status: 400 })
  }

  const { eventType, providerMessageId } = describeEvent(rawEvent)

  // Ack imediato + processamento em after(): evita segurar a conexão da
  // Evolution durante o processamento (mesmo padrão do webhook Asaas).
  // O processamento é idempotente (dedupe por providerMessageId), então uma
  // falha aqui é logada/reportada em vez de depender de redelivery via 500.
  after(async () => {
    try {
      const output = await processEvoWebhookUseCase.execute({
        teamId: config.teamId,
        configId: config.id,
        rawEvent,
      })

      if (!output.isValid) {
        console.error(
          "[WhatsAppEvoWebhookRoute][after] processing failed",
          { eventType, providerMessageId, errors: output.errorMessages }
        )
        Sentry.captureMessage("[WhatsAppEvoWebhookRoute] processing failed", {
          level: "error",
          tags: { route: "WhatsAppEvoWebhookRoute", phase: "after" },
          extra: {
            teamId: config.teamId,
            eventType,
            providerMessageId,
            errors: output.errorMessages,
          },
        })
      }
    } catch (error) {
      rethrowIfPrerenderInterrupted(error)
      console.error("[WhatsAppEvoWebhookRoute][after] unexpected error", {
        eventType,
        providerMessageId,
        error,
      })
      Sentry.captureException(error, {
        tags: { route: "WhatsAppEvoWebhookRoute", phase: "after" },
        extra: { teamId: config.teamId, eventType, providerMessageId },
      })
    }
  })

  return NextResponse.json({ processed: true }, { status: 200 })
}
