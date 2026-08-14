import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import {
  EmailCampaignUseCase,
  type ManualDispatchJob,
} from "@/app/api/useCases/email/EmailCampaignUseCase"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"
import { publishEmailCampaignDispatchWake } from "@/lib/queues/email-campaign-dispatch"

export const maxDuration = 300

function makeUseCase() {
  return new EmailCampaignUseCase()
}

async function parseRetryFailedOnly(request: NextRequest): Promise<boolean> {
  try {
    const body = (await request.json()) as { retryFailedOnly?: unknown } | null
    return body?.retryFailedOnly === true
  } catch {
    return false
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const teamAccess = await getTeamAccess(request)
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status })
    }

    const retryFailedOnly = await parseRetryFailedOnly(request)
    const useCase = makeUseCase()
    const output = await useCase.startManualDispatch(id, teamAccess.access, { retryFailedOnly })
    if (!output.isValid || !output.result) {
      const status = output.errorMessages.some((message) => message.includes("permissão"))
        ? 403
        : 400
      return NextResponse.json(output, { status })
    }

    // Fase 4 / PR1: só publica o wake da fila `email-campaign-dispatch` — quem
    // envia via Resend é o consumer (`processDispatchQueueBatch`), fora deste
    // isolate de 300s. Se o publish falhar, `resumeOrphanSendingDispatches`
    // (cron) é a rede de segurança que reabre e republica o wake.
    const job = output.result as ManualDispatchJob
    try {
      await publishEmailCampaignDispatchWake({ dispatchId: job.dispatchId, reason: "start" })
    } catch (error) {
      rethrowIfPrerenderInterrupted(error)
      console.error("[EmailCampaignSendRoute][publishWake]", error)
    }

    return NextResponse.json(
      new Output(true, output.successMessages, [], {
        campaignId: job.campaignId,
        dispatchId: job.dispatchId,
        totalRecipients: job.totalRecipients,
        retryFailedOnly: job.retryFailedOnly,
        status: "sending" as const,
        ...(job.warnings?.length ? { warnings: job.warnings } : {}),
      }),
      { status: 202 }
    )
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[EmailCampaignSendRoute][POST]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
