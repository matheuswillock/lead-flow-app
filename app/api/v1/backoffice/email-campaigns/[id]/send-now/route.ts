import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { requireManagerAccess } from "@/app/api/v1/backoffice/utils/requireManagerAccess"
import { backofficeEmailCampaignUseCase } from "@/app/api/useCases/backofficeEmailCampaign/BackofficeEmailCampaignUseCase"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"

export const maxDuration = 60

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const result = await getBackofficeAccess(request)
    if (result.error) {
      return NextResponse.json(result.error, { status: result.status })
    }
    const denied = requireManagerAccess(result.access)
    if (denied) return denied

    if (!result.access.backofficeUserId) {
      return NextResponse.json(
        new Output(false, [], ["Usuário backoffice sem vínculo ativo"], null),
        { status: 403 }
      )
    }

    const output = await backofficeEmailCampaignUseCase.sendNow(id, result.access.backofficeUserId)
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeEmailCampaignSendNowRoute][POST]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
