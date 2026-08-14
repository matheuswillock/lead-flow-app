// Webhook URL canônica (sem redirect): https://www.corretorstudio.com/api/webhooks/resend
import { after, NextResponse, type NextRequest } from "next/server"
import { Webhook } from "svix"
import type { Prisma } from "@prisma/client"
import type { ResendWebhookPayload } from "@/app/api/useCases/resendWebhook/resendWebhookTypes"
import {
  formatProcessingError,
  resendWebhookProcessingFailureRepository,
} from "@/app/api/infra/data/repositories/resendWebhookProcessingFailure/ResendWebhookProcessingFailureRepository"
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';
import { publishWithRetry } from "@/lib/queues/publish-with-retry"
import { publishResendWebhookEmailLogEvent } from "@/lib/queues/resend-webhook-emaillog-events"

/** Backpressure por isolate: default 2 reduz pressão no pool sob rajada Resend. */
const MAX_CONCURRENT = Math.max(1, Number(process.env.RESEND_WEBHOOK_MAX_CONCURRENT ?? 2))
let inFlight = 0

export async function POST(request: NextRequest) {
  try {
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET
    if (!webhookSecret) {
      console.error("[ResendWebhookRoute][POST] RESEND_WEBHOOK_SECRET não configurado")
      return NextResponse.json({ received: true }, { status: 200 })
    }

    const svixId = request.headers.get("svix-id")
    const svixTimestamp = request.headers.get("svix-timestamp")
    const svixSignature = request.headers.get("svix-signature")

    if (!svixId || !svixTimestamp || !svixSignature) {
      console.error("[ResendWebhookRoute][POST] Headers svix ausentes")
      return NextResponse.json({ error: "Headers de assinatura ausentes" }, { status: 400 })
    }

    const rawBody = await request.text()

    const wh = new Webhook(webhookSecret)
    let event: ResendWebhookPayload

    try {
      event = wh.verify(rawBody, {
        "svix-id": svixId,
        "svix-timestamp": svixTimestamp,
        "svix-signature": svixSignature,
      }) as ResendWebhookPayload
    } catch (verifyError) {
      console.error("[ResendWebhookRoute][POST] Assinatura inválida:", verifyError)
      return NextResponse.json({ error: "Assinatura inválida" }, { status: 401 })
    }

    if (inFlight >= MAX_CONCURRENT) {
      console.info("[ResendWebhookRoute][POST] Semáforo cheio, persistindo no outbox:", event.type, svixId)
      try {
        await resendWebhookProcessingFailureRepository.upsertFromProcessingFailure({
          svixId,
          eventType: event.type,
          payload: event as Prisma.InputJsonValue,
          lastError: "Semáforo do webhook saturado; processamento adiado",
          failureReason: "semaphore_saturated",
        })
      } catch (outboxError) {
        console.error("[ResendWebhookRoute][POST][saturated][outbox]", outboxError)
      }
      // Sempre 200: a Resend só reenvia em resposta não-2xx. Devolver 503 aqui
      // realimenta o loop de retry que satura o semáforo (200k retries/24h).
      return NextResponse.json({ received: true }, { status: 200 })
    }

    inFlight++
    after(async () => {
      try {
        const publishResult = await publishWithRetry(() =>
          publishResendWebhookEmailLogEvent({ event, svixId })
        )
        if (!publishResult.ok) {
          console.error("[ResendWebhookRoute][POST][after][publish-exhausted]", {
            svixId,
            eventType: event.type,
            attempts: publishResult.attempts,
            error: publishResult.error,
          })
          try {
            await resendWebhookProcessingFailureRepository.upsertFromProcessingFailure({
              svixId,
              eventType: event.type,
              payload: event as Prisma.InputJsonValue,
              lastError: formatProcessingError(publishResult.error),
              failureReason: "queue_publish_failed",
            })
          } catch (outboxError) {
            console.error("[ResendWebhookRoute][POST][after][outbox]", outboxError)
          }
        }
      } finally {
        inFlight--
      }
    })

    return NextResponse.json({ received: true }, { status: 200 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[ResendWebhookRoute][POST]", error)
    return NextResponse.json({ error: "Erro interno ao processar webhook" }, { status: 500 })
  }
}
