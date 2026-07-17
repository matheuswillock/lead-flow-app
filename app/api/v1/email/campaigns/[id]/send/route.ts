import { after, NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import {
  EmailCampaignUseCase,
  type ManualDispatchJob,
} from "@/app/api/useCases/email/EmailCampaignUseCase"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"

export const maxDuration = 300

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
    const output = await useCase.startManualDispatch(id, teamAccess.access)
    if (!output.isValid || !output.result) {
      const status = output.errorMessages.some((message) => message.includes("permissão"))
        ? 403
        : 400
      return NextResponse.json(output, { status })
    }

    const job = output.result as ManualDispatchJob
    after(async () => {
      try {
        await useCase.completeManualDispatch(job)
      } catch (error) {
        rethrowIfPrerenderInterrupted(error)
        console.error("[EmailCampaignSendRoute][after]", error)
      }
    })

    return NextResponse.json(
      new Output(true, output.successMessages, [], {
        campaignId: job.campaignId,
        dispatchId: job.dispatchId,
        totalRecipients: job.totalRecipients,
        status: "sending" as const,
      }),
      { status: 202 }
    )
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[EmailCampaignSendRoute][POST]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
