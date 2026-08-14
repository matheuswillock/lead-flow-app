import { type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"
import {
  backofficeStudioEmailUseCase,
} from "@/app/api/useCases/backofficeStudioEmail/BackofficeStudioEmailUseCase"
import type { ManualDispatchJob } from "@/app/api/useCases/email/EmailCampaignUseCase"
import { publishEmailCampaignDispatchWake } from "@/lib/queues/email-campaign-dispatch"
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

    let retryFailedOnly = false
    try {
      const body = (await request.json()) as { retryFailedOnly?: unknown } | null
      retryFailedOnly = body?.retryFailedOnly === true
    } catch {
      retryFailedOnly = false
    }

    const output = await backofficeStudioEmailUseCase.startManualDispatch(
      resolved.actor,
      all.campaignId,
      { retryFailedOnly }
    )
    if (!output.isValid || !output.result) {
      const status = output.errorMessages.some((message) => message.includes("permissão"))
        ? 403
        : 400
      return studioEmailJson(output, status, status)
    }

    // Fase 4 / PR1: só publica o wake — mesmo caminho do /send de produto.
    const job = output.result as ManualDispatchJob
    try {
      await publishEmailCampaignDispatchWake({ dispatchId: job.dispatchId, reason: "start" })
    } catch (error) {
      rethrowIfPrerenderInterrupted(error)
      console.error("[BackofficeStudioEmailCampaignSendRoute][publishWake]", error)
    }

    return studioEmailJson(
      new Output(true, output.successMessages, [], {
        campaignId: job.campaignId,
        dispatchId: job.dispatchId,
        totalRecipients: job.totalRecipients,
        retryFailedOnly: job.retryFailedOnly,
        status: "sending" as const,
        ...(job.warnings?.length ? { warnings: job.warnings } : {}),
      }),
      202
    )
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeStudioEmailCampaignSendRoute][POST]", error)
    return studioEmailError(["Erro interno"])
  }
}
