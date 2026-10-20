import { NextResponse } from "next/server"
import { PaymentProviderError } from "@/lib/payment-provider/errors"
import { backofficeAdhesionUseCase } from "@/app/api/useCases/backofficeAdhesion/BackofficeAdhesionUseCase"
import { createAbacatePayProvider, resolvePaymentProviderEnvironment } from "@/app/api/useCases/paymentProviderPayment/paymentProviderPaymentComposition"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"

export async function POST(request: Request) {
  try {
    const rawBody = await request.text()
    const url = new URL(request.url)
    const webhookSecret = url.searchParams.get("webhookSecret")

    const provider = createAbacatePayProvider(resolvePaymentProviderEnvironment())
    const verified = provider.verifyRequest({
      rawBody,
      signature: request.headers.get("x-abacate-signature") ?? request.headers.get("x-signature"),
      query: { webhookSecret: webhookSecret ?? "" },
    })

    const event = provider.normalizeEvent(verified)
    if (!event) {
      return NextResponse.json({ accepted: false, reason: "evento não processado" }, { status: 202 })
    }

    // Only process checkout events for backoffice adhesion
    if (!event.event.startsWith("PAYMENT_")) {
      return NextResponse.json({ accepted: false, reason: "evento não aplicável" }, { status: 202 })
    }

    if (!event.externalPaymentId) {
      return NextResponse.json({ accepted: false, reason: "externalPaymentId ausente" }, { status: 202 })
    }

    const output = await backofficeAdhesionUseCase.processAbacatePayWebhook(event.event, {
      id: event.externalPaymentId!,
      status: event.status,
      amount: event.amountInCents ? event.amountInCents / 100 : undefined,
      metadata: event.attemptId ? { adhesionId: event.attemptId } : undefined,
      updatedAt: event.occurredAt ?? undefined,
    })

    return NextResponse.json({ accepted: true, processed: output.result?.processed ?? false }, { status: 202 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    const status = error instanceof PaymentProviderError && error.code === "WEBHOOK_INVALID" ? 401 : 500
    console.error("[POST /api/v1/webhooks/backoffice-adhesion/abacate] Error", {
      message: error instanceof Error ? error.message : "unknown",
    })
    return NextResponse.json({ accepted: false }, { status })
  }
}