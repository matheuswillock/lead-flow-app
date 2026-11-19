import { NextResponse, type NextRequest, connection } from "next/server"
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { requireManagerAccess } from "@/app/api/v1/backoffice/utils/requireManagerAccess"
import {
  readConfiguredAbacatePublicKey,
  resolveCardAvailability,
} from "@/lib/payment-methods/availability"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"

/**
 * GET /api/v1/backoffice/payments/card-checkout
 * Informa se a cobrança avulsa pode oferecer cartão e a chave pública que o abacatepay.js usa para
 * tokenizar no navegador. A chave pública não é segredo (o checkout público também a expõe).
 */
export async function GET(request: NextRequest) {
  await connection()

  try {
    const result = await getBackofficeAccess(request)
    if (result.error) {
      return NextResponse.json(result.error, { status: result.status })
    }

    const managerDenied = requireManagerAccess(result.access)
    if (managerDenied) {
      return managerDenied
    }

    const { card } = await resolveCardAvailability()
    const publicKey = card ? await readConfiguredAbacatePublicKey() : null
    return NextResponse.json(
      new Output(true, [], [], { cardOffered: card && Boolean(publicKey), publicKey }),
      { status: 200, headers: { "Cache-Control": "no-store" } },
    )
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficePaymentsCardCheckoutRoute][GET]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
