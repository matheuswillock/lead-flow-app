import { NextResponse } from "next/server"
import { Output } from "@/lib/output"
import { getPaymentProviderPaymentUseCase } from "@/app/api/useCases/paymentProviderPayment/paymentProviderPaymentComposition"

type PaymentRequestBody = {
  method?: "PIX" | "CARD"
  customer?: {
    name?: string
    email?: string
    taxId?: string
    cellphone?: string
  }
  cardToken?: string
  tokenIssuedAt?: string
  installments?: number
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ purchaseId: string }> },
) {
  const supabaseId = request.headers.get("x-supabase-user-id")
  if (!supabaseId) {
    return NextResponse.json(new Output(false, [], ["Não autenticado"], null), { status: 401 })
  }

  try {
    const { purchaseId } = await params
    const idempotencyKey = request.headers.get("idempotency-key")
    if (!idempotencyKey) {
      return NextResponse.json(new Output(false, [], ["Idempotency-Key é obrigatório"], null), {
        status: 400,
      })
    }

    const body = (await request.json()) as PaymentRequestBody
    const customer = body.customer
    const useCase = getPaymentProviderPaymentUseCase()
    const output = await useCase.execute({
      purchaseId,
      supabaseId,
      idempotencyKey,
      method: body.method ?? "PIX",
      customer: {
        name: customer?.name ?? "",
        email: customer?.email ?? "",
        taxId: customer?.taxId ?? "",
        cellphone: customer?.cellphone ?? "",
      },
      cardToken: body.cardToken,
      tokenIssuedAt: body.tokenIssuedAt,
      installments: body.installments,
    })
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    console.error("[POST /api/v1/payment-provider-payment] Error", {
      message: error instanceof Error ? error.message : "unknown",
    })
    return NextResponse.json(new Output(false, [], ["Erro interno ao iniciar pagamento"], null), {
      status: 500,
    })
  }
}
