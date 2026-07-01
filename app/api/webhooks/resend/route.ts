// Webhook URL canônica (sem redirect): https://www.corretorstudio.com/api/webhooks/resend
import { NextResponse, type NextRequest } from "next/server"
import { Webhook } from "svix"
import { resendWebhookUseCase } from "@/app/api/useCases/resendWebhook/ResendWebhookUseCase"
import type { ResendWebhookPayload } from "@/app/api/useCases/resendWebhook/resendWebhookTypes"
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';

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

    await resendWebhookUseCase.handle({ event, svixId })

    return NextResponse.json({ received: true }, { status: 200 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[ResendWebhookRoute][POST]", error)
    return NextResponse.json({ received: true }, { status: 200 })
  }
}
