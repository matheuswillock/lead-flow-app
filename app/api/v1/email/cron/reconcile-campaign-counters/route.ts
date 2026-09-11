import { NextResponse, type NextRequest, connection } from "next/server"
import { Output } from "@/lib/output"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"
import { withCronAudit } from "@/app/api/lib/cron/withCronAudit"
import { getDefaultCronSlackCallback } from "@/app/api/lib/cron/cronSlackCallback"
import { reconcileCampaignCountersUseCase } from "@/app/api/useCases/email/ReconcileCampaignCountersUseCase"

export const maxDuration = 60

export async function GET(request: NextRequest) {
  await connection()

  try {
    const authHeader = request.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(new Output(false, [], ["Não autorizado"], null), { status: 401 })
    }

    const result = await withCronAudit(
      {
        cronKey: "email-campaign-counters-reconcile",
        cronPath: "/api/v1/email/cron/reconcile-campaign-counters",
      },
      async () => reconcileCampaignCountersUseCase.execute(),
      {
        onFailure: getDefaultCronSlackCallback(),
      }
    )

    return NextResponse.json(result, { status: result.isValid ? 200 : 500 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[EmailCronReconcileCampaignCountersRoute][GET]", error)
    return NextResponse.json(
      new Output(false, [], ["Erro interno no cron de reconciliação de contadores de campanha"], null),
      { status: 500 }
    )
  }
}
