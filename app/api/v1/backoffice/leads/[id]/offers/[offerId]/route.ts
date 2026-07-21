import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { requireManagerAccess } from "@/app/api/v1/backoffice/utils/requireManagerAccess"
import { backofficeLeadOfferUseCase } from "@/app/api/useCases/backofficeLeadOffer/BackofficeLeadOfferUseCase"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; offerId: string }> }
) {
  const { id, offerId } = await params
  try {
    const result = await getBackofficeAccess(request)
    if (result.error) {
      return NextResponse.json(result.error, { status: result.status })
    }
    const denied = requireManagerAccess(result.access)
    if (denied) return denied

    const output = await backofficeLeadOfferUseCase.revokeOffer(id, offerId)
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeLeadOfferByIdRoute][DELETE]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
