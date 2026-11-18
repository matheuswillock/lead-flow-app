import { NextRequest, NextResponse } from "next/server"
import { getBillingGracePaymentUseCase } from "@/app/api/useCases/billingGracePayment/billingGracePaymentComposition"

const useCase = getBillingGracePaymentUseCase()

export async function POST(request: NextRequest) {
  const supabaseId = request.headers.get("x-supabase-user-id")
  if (!supabaseId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  try {
    const body = (await request.json()) as { idempotencyKey?: string; cycle?: string; keptUserIds?: unknown; cardToken?: string; installments?: number }
    const output = await useCase.createCardPayment({
      supabaseId,
      idempotencyKey: typeof body.idempotencyKey === "string" ? body.idempotencyKey : "",
      cycle: typeof body.cycle === "string" ? body.cycle : "",
      keptUserIds: Array.isArray(body.keptUserIds) ? body.keptUserIds.filter((id): id is string => typeof id === "string") : undefined,
      cardToken: typeof body.cardToken === "string" ? body.cardToken : "",
      installments: typeof body.installments === "number" ? body.installments : 1,
    })
    return NextResponse.json(output, { status: output.isValid ? 201 : 400 })
  } catch {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 })
  }
}
