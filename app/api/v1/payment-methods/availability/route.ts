import { NextResponse, connection } from "next/server"
import { Output } from "@/lib/output"
import { resolveCardAvailability } from "@/lib/payment-methods/availability"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"

/**
 * GET /api/v1/payment-methods/availability
 * Público: informa quais formas de pagamento os checkouts podem oferecer agora.
 * Não expõe segredo; o cache curto evita martelar a rota a cada abertura de diálogo.
 */
export async function GET() {
  // Lê env em runtime: sem isso a rota seria pré-renderizada no build com o valor da época.
  await connection()

  try {
    const { card, reason, availableBillingTypes } = resolveCardAvailability()
    return NextResponse.json(new Output(true, [], [], { card, reason, availableBillingTypes }), {
      status: 200,
      headers: { "Cache-Control": "public, max-age=30, s-maxage=30, stale-while-revalidate=60" },
    })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[PaymentMethodsAvailabilityRoute][GET]", error)
    // Falha fechada: sem leitura confiável, só PIX.
    return NextResponse.json(
      new Output(false, [], ["Erro ao consultar formas de pagamento"], {
        card: false,
        reason: "PROVIDER_WITHOUT_CARD",
        availableBillingTypes: ["PIX"],
      }),
      { status: 500, headers: { "Cache-Control": "no-store" } },
    )
  }
}
