import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { requireManagerAccess } from "@/app/api/v1/backoffice/utils/requireManagerAccess"
import { backofficeSubscriptionChangeOrderUseCase } from "@/app/api/useCases/backoffice/BackofficeSubscriptionChangeOrderUseCase"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"

/**
 * POST /api/v1/backoffice/subscription-change-orders/[id]/approve — E6/G1.
 * Trava S7/DA6: aprova preço avulso acima do teto. `requireManagerAccess`
 * (lição S1) — mesmo padrão de approve-discount.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await getBackofficeAccess(request)
    if (access.error) {
      return NextResponse.json(access.error, { status: access.status })
    }
    const denied = requireManagerAccess(access.access)
    if (denied) return denied

    const { id } = await params
    const output = await backofficeSubscriptionChangeOrderUseCase.approveOverride(
      id,
      access.access.profileId
    )

    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeSubscriptionChangeOrderApproveRoute][POST]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
