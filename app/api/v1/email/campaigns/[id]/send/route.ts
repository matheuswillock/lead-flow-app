import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { EmailCampaignUseCase } from "@/app/api/useCases/email/EmailCampaignUseCase"
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';

function makeUseCase() {
  return new EmailCampaignUseCase()
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const teamAccess = await getTeamAccess(request)
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status })
    }

    const useCase = makeUseCase()
    const output = await useCase.send(id, teamAccess.access)
    const status = !output.isValid
      ? output.errorMessages.some((message) => message.includes("permissão"))
        ? 403
        : 400
      : 200
    return NextResponse.json(output, { status })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[EmailCampaignSendRoute][POST]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
