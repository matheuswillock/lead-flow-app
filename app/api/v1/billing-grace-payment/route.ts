import { NextRequest, NextResponse } from "next/server"
import { getBillingGracePaymentUseCase } from "@/app/api/useCases/billingGracePayment/billingGracePaymentComposition"
import { Output } from "@/lib/output"
import { hasTermsAcceptance, TERMS_ACCEPTANCE_REQUIRED_MESSAGE } from "@/lib/legal/terms-acceptance"
import { LEGAL_DOCUMENTS_VERSION } from "@/lib/legal/legal-document-types"

const useCase = getBillingGracePaymentUseCase()

export async function GET(request: NextRequest) {
  const supabaseId = request.headers.get("x-supabase-user-id")
  if (!supabaseId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const paymentId = request.nextUrl.searchParams.get("paymentId")
  const output = paymentId
    ? await useCase.getPayment({ id: paymentId, supabaseId })
    : await useCase.getQuote(supabaseId)
  return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
}
export async function POST(request: NextRequest) {
  const supabaseId = request.headers.get("x-supabase-user-id")
  if (!supabaseId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const body = (await request.json()) as { idempotencyKey?: string; cycle?: string; keptUserIds?: unknown; termsAccepted?: unknown }
  if (!hasTermsAcceptance(body.termsAccepted)) {
    return NextResponse.json(new Output(false, [], [TERMS_ACCEPTANCE_REQUIRED_MESSAGE], null), { status: 400 })
  }
  const keptUserIds = Array.isArray(body.keptUserIds)
    ? body.keptUserIds.filter((id): id is string => typeof id === "string")
    : undefined
  const output = await useCase.createPixPayment({
    supabaseId,
    idempotencyKey: body.idempotencyKey ?? "",
    cycle: typeof body.cycle === "string" ? body.cycle : "",
    keptUserIds,
    // Mesmo carimbo do add-on: momento do aceite e versão vigente dos documentos.
    termsAcceptedAt: new Date().toISOString(),
    termsVersion: LEGAL_DOCUMENTS_VERSION,
  })
  return NextResponse.json(output, { status: output.isValid ? 201 : 400 })
}
