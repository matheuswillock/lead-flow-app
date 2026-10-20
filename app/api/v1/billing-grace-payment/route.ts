import { NextRequest, NextResponse } from "next/server"
import { getBillingGracePaymentUseCase } from "@/app/api/useCases/billingGracePayment/billingGracePaymentComposition"

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

  const body = (await request.json()) as { idempotencyKey?: string }
  const output = await useCase.createPixPayment({
    supabaseId,
    idempotencyKey: body.idempotencyKey ?? "",
  })
  return NextResponse.json(output, { status: output.isValid ? 201 : 400 })
}
