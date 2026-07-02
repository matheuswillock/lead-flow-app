import { NextRequest, NextResponse } from "next/server"
import { whatsAppRepository } from "@/app/api/infra/data/repositories/whatsapp/WhatsAppRepository"
import { processEvoWebhookUseCase } from "@/app/api/useCases/whatsapp/ProcessEvoWebhookUseCase"
import { isValidEvoWebhookPayload } from "@/lib/whatsapp/webhook-signature"

const MAX_WEBHOOK_RETRIES = 5
const failedEvents = new Map<string, { count: number; firstAt: number }>()
const DEAD_LETTER_TTL_MS = 10 * 60 * 1000

function eventKey(teamId: string, rawEvent: unknown): string {
  const ev = rawEvent as Record<string, unknown>
  const data = ev?.["data"] as Record<string, unknown> | undefined
  const key = data?.["key"] as Record<string, unknown> | undefined
  const msgId = typeof key?.["id"] === "string" ? key["id"] : ""
  const eventType = typeof ev?.["event"] === "string" ? ev["event"] : ""
  return `${teamId}:${eventType}:${msgId}`
}

function pruneStaleEntries() {
  const now = Date.now()
  for (const [k, v] of failedEvents) {
    if (now - v.firstAt > DEAD_LETTER_TTL_MS) failedEvents.delete(k)
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

  const key = eventKey(config.teamId, rawEvent)

  if (key) {
    const entry = failedEvents.get(key)
    if (entry && entry.count >= MAX_WEBHOOK_RETRIES) {
      console.error(
        "[WhatsAppEvoWebhookRoute][POST] Dead-letter: exceeded max retries",
        { key, count: entry.count }
      )
      return NextResponse.json({ processed: true }, { status: 200 })
    }
  }

  const output = await processEvoWebhookUseCase.execute({
    teamId: config.teamId,
    configId: config.id,
    rawEvent,
  })

  if (!output.isValid) {
    console.error(
      "[WhatsAppEvoWebhookRoute][POST] processing failed",
      output.errorMessages
    )

    if (key) {
      const entry = failedEvents.get(key)
      if (entry) {
        entry.count++
      } else {
        failedEvents.set(key, { count: 1, firstAt: Date.now() })
      }

      if (failedEvents.size > 500) pruneStaleEntries()
    }

    // isValid só é false quando o processamento lança uma exceção interna
    // (nenhum ramo de "evento ignorado intencionalmente" seta isValid=false).
    // Retornar 500 permite que a Evolution reentregue o evento; o
    // processamento agora é seguro para redelivery (dedupe por
    // providerMessageId, healing de efeitos pendentes e P2002 tratado).
    return NextResponse.json({ processed: false }, { status: 500 })
  }

  if (key) failedEvents.delete(key)

  return NextResponse.json({ processed: true }, { status: 200 })
}
