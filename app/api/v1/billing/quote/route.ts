import { NextResponse, type NextRequest, connection } from "next/server"
import { Output } from "@/lib/output"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"
import { billingQuoteUseCase } from "@/app/api/useCases/billingQuote/billingQuoteFactory"

function getErrorStatus(errorMessage: string | undefined): number {
  if (errorMessage === "Conta de cobrança não encontrada") {
    return 404
  }
  if (
    errorMessage === "Apenas o master pode visualizar a projeção de cobrança" ||
    errorMessage === "Esta conta está bloqueada"
  ) {
    return 403
  }
  return 400
}

export async function GET(request: NextRequest) {
  await connection()

  try {
    const supabaseId = request.headers.get("x-supabase-user-id")
    if (!supabaseId) {
      return NextResponse.json(new Output(false, [], ["Não autenticado"], null), { status: 401 })
    }

    const output = await billingQuoteUseCase.executeForAuthenticatedSupabaseId(supabaseId)
    return NextResponse.json(output, {
      status: output.isValid ? 200 : getErrorStatus(output.errorMessages[0]),
    })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BillingQuoteRoute][GET] Erro ao calcular projeção:", error)
    return NextResponse.json(
      new Output(false, [], ["Erro interno ao calcular projeção de cobrança"], null),
      { status: 500 }
    )
  }
}
