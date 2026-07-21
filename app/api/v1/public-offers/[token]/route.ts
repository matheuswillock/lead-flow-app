import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { backofficeLeadOfferUseCase } from "@/app/api/useCases/backofficeLeadOffer/BackofficeLeadOfferUseCase"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  try {
    const output = await backofficeLeadOfferUseCase.resolvePublicOffer(token)
    if (!output.isValid) {
      return NextResponse.json(output, { status: 404 })
    }
    return NextResponse.json(output, { status: 200 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[PublicOfferShareRoute][GET]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
