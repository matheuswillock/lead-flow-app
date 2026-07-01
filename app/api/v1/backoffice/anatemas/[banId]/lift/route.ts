import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { requireMasterAccess } from "@/app/api/v1/backoffice/utils/requireMasterAccess"
import { backofficeAnathemasUseCase } from "@/app/api/useCases/backoffice/BackofficeAnathemasUseCase"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ banId: string }> }
) {
  try {
    const accessResult = await getBackofficeAccess(request)
    if (accessResult.error) {
      return NextResponse.json(accessResult.error, { status: accessResult.status })
    }

    const denied = requireMasterAccess(accessResult.access)
    if (denied) return denied

    const { banId } = await params
    const body = (await request.json().catch(() => ({}))) as { liftReason?: string | null }

    const output = await backofficeAnathemasUseCase.liftBan(
      banId,
      body.liftReason,
      accessResult.access
    )

    return NextResponse.json(output, {
      status: output.isValid
        ? 200
        : output.errorMessages.includes("Banimento ativo não encontrado")
          ? 404
          : 400,
    })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeAnatemasLiftRoute][POST]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
