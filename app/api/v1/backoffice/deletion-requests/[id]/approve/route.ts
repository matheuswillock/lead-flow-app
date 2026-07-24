import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { requireManagerAccess } from "@/app/api/v1/backoffice/utils/requireManagerAccess"
import { backofficeDeletionRequestUseCase } from "@/app/api/useCases/backofficeDeletion/BackofficeDeletionRequestUseCase"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const accessResult = await getBackofficeAccess(request)
    if (accessResult.error) {
      return NextResponse.json(accessResult.error, { status: accessResult.status })
    }
    const denied = requireManagerAccess(accessResult.access)
    if (denied) return denied

    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const decision = body.decision as "approved" | "rejected"

    if (decision !== "approved" && decision !== "rejected") {
      return NextResponse.json(
        new Output(false, [], ["decision deve ser approved ou rejected"], null),
        { status: 400 }
      )
    }

    const output = await backofficeDeletionRequestUseCase.decide({
      requestId: id,
      decision,
      approverProfileId: accessResult.access.profileId,
      approverEmail: accessResult.access.backofficeEmail,
    })

    let status = 200
    if (!output.isValid) {
      const msg = output.errorMessages[0] ?? ""
      if (msg.includes("não encontrada")) status = 404
      else if (msg.includes("autorizados")) status = 403
      else status = 400
    }

    return NextResponse.json(output, { status })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeDeletionRequestApproveRoute][POST]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
