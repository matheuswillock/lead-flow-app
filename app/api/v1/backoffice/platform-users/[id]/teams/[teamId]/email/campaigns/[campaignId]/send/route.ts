import { after, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"
import {
  backofficeStudioEmailUseCase,
} from "@/app/api/useCases/backofficeStudioEmail/BackofficeStudioEmailUseCase"
import type { ManualDispatchJob } from "@/app/api/useCases/email/EmailCampaignUseCase"
import {
  resolveStudioEmailActor,
  studioEmailError,
  studioEmailJson,
  type StudioEmailRouteParams,
} from "@/app/api/v1/backoffice/utils/studioEmailRoute"

export const maxDuration = 300

type RouteContext = { params: Promise<StudioEmailRouteParams & { campaignId: string }> }

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const all = await params
    const resolved = await resolveStudioEmailActor(request, Promise.resolve(all))
    if (resolved.error) return resolved.error

    const output = await backofficeStudioEmailUseCase.startManualDispatch(
      resolved.actor,
      all.campaignId
    )
    if (!output.isValid || !output.result) {
      const status = output.errorMessages.some((message) => message.includes("permissão"))
        ? 403
        : 400
      return studioEmailJson(output, status, status)
    }

    const job = output.result as ManualDispatchJob
    after(async () => {
      try {
        await backofficeStudioEmailUseCase.completeManualDispatch(job)
      } catch (error) {
        rethrowIfPrerenderInterrupted(error)
        console.error("[BackofficeStudioEmailCampaignSendRoute][after]", error)
      }
    })

    return studioEmailJson(
      new Output(true, output.successMessages, [], {
        campaignId: job.campaignId,
        dispatchId: job.dispatchId,
        totalRecipients: job.totalRecipients,
        status: "sending" as const,
      }),
      202
    )
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeStudioEmailCampaignSendRoute][POST]", error)
    return studioEmailError(["Erro interno"])
  }
}
