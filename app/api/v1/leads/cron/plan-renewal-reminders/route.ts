import { NextResponse, type NextRequest, connection } from "next/server"
import { Output } from "@/lib/output"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"
import { scheduleAutomaticFollowUpsUseCase } from "@/app/api/useCases/leadFollowUp/leadFollowUpComposition"
import { withCronAudit } from "@/app/api/lib/cron/withCronAudit"
import { getDefaultCronSlackCallback } from "@/app/api/lib/cron/cronSlackCallback"

/** Uma vez por dia: agenda os avisos de 90, 60 e 30 dias antes do fim da vigência (Carteira). */
export async function GET(request: NextRequest) {
  await connection()

  try {
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
      return NextResponse.json(new Output(false, [], ["Não autorizado"], null), { status: 401 })
    }

    const output = await withCronAudit(
      { cronKey: "plan-renewal-reminders", cronPath: "/api/v1/leads/cron/plan-renewal-reminders" },
      () => scheduleAutomaticFollowUpsUseCase.schedulePlanRenewals(),
      { onFailure: getDefaultCronSlackCallback() },
    )
    return NextResponse.json(output, { status: output.isValid ? 200 : 500 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[PlanRenewalRemindersCronRoute][GET] Erro:", error)
    return NextResponse.json(new Output(false, [], ["Erro interno no cron de vigência"], null), { status: 500 })
  }
}
