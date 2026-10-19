import { NextResponse } from "next/server"
import { PaymentProviderError } from "@/lib/payment-provider/errors"
import { createPaymentProviderWebhookService } from "@/app/api/useCases/paymentProviderWebhook/paymentProviderWebhookComposition"

export async function POST(request: Request) {
  try {
    const rawBody = await request.text()
    const composition = await createPaymentProviderWebhookService()
    const result = await composition.service.handle({
      externalAccountContext: composition.externalAccountContext,
      request: {
        rawBody,
        signature: request.headers.get("x-abacate-signature") ?? request.headers.get("x-signature"),
        query: { webhookSecret: new URL(request.url).searchParams.get("webhookSecret") },
      },
    })
    return NextResponse.json({ accepted: true, action: result.action }, { status: 202 })
  } catch (error) {
    const status =
      error instanceof PaymentProviderError && error.code === "WEBHOOK_INVALID" ? 401 : 500
    console.error("[POST /api/v1/webhooks/payment-provider/abacate] Error", {
      message: error instanceof Error ? error.message : "unknown",
    })
    return NextResponse.json({ accepted: false }, { status })
  }
}
