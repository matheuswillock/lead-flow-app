import { NextRequest, NextResponse } from "next/server"
import { resendWebhookLogUseCase } from "@/app/api/useCases/integrations/webhooks/ResendWebhookLogUseCase"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"
import { Output } from "@/lib/output"

const routePrefix = "[ResendWebhookLogRoute]"

type RouteContext = { params: Promise<{ id: string; logId: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const accessResult = await getTeamAccess(request)
    if ("error" in accessResult) {
      return NextResponse.json(accessResult.error, { status: accessResult.status })
    }
    if (accessResult.access.teamMember.role !== "manager") {
      return NextResponse.json(
        new Output(false, [], ["Acesso negado. Apenas managers podem gerenciar webhooks."], null),
        { status: 403 },
      )
    }

    const { id, logId } = await context.params
    const output = await resendWebhookLogUseCase.execute(accessResult.access, id, logId)
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error(`${routePrefix}[POST] Erro:`, error)
    return NextResponse.json(new Output(false, [], ["Erro ao reenviar webhook"], null), {
      status: 500,
    })
  }
}
