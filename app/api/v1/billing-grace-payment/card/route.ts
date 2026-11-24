import { NextRequest, NextResponse } from "next/server"
import { getBillingGracePaymentUseCase } from "@/app/api/useCases/billingGracePayment/billingGracePaymentComposition"
import { Output } from "@/lib/output"
import { hasTermsAcceptance, TERMS_ACCEPTANCE_REQUIRED_MESSAGE } from "@/lib/legal/terms-acceptance"
import { LEGAL_DOCUMENTS_VERSION } from "@/lib/legal/legal-document-types"

const useCase = getBillingGracePaymentUseCase()

export async function POST(request: NextRequest) {
  const supabaseId = request.headers.get("x-supabase-user-id")
  if (!supabaseId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  try {
    const body = (await request.json()) as { idempotencyKey?: string; cycle?: string; keptUserIds?: unknown; cardToken?: string; installments?: number; termsAccepted?: unknown }
    if (!hasTermsAcceptance(body.termsAccepted)) {
      return NextResponse.json(new Output(false, [], [TERMS_ACCEPTANCE_REQUIRED_MESSAGE], null), { status: 400 })
    }
    const output = await useCase.createCardPayment({
      supabaseId,
      idempotencyKey: typeof body.idempotencyKey === "string" ? body.idempotencyKey : "",
      cycle: typeof body.cycle === "string" ? body.cycle : "",
      keptUserIds: Array.isArray(body.keptUserIds) ? body.keptUserIds.filter((id): id is string => typeof id === "string") : undefined,
      cardToken: typeof body.cardToken === "string" ? body.cardToken : "",
      installments: typeof body.installments === "number" ? body.installments : 1,
      // Mesmo carimbo do add-on: momento do aceite e versão vigente dos documentos.
      termsAcceptedAt: new Date().toISOString(),
      termsVersion: LEGAL_DOCUMENTS_VERSION,
    })
    return NextResponse.json(output, { status: output.isValid ? 201 : 400 })
  } catch {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 })
  }
}
