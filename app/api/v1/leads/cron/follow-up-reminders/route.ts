import { NextResponse, type NextRequest, connection } from "next/server"
import { Output } from "@/lib/output"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"
import {
  processFollowUpRemindersUseCase,
  scheduleAutomaticFollowUpsUseCase,
} from "@/app/api/useCases/leadFollowUp/leadFollowUpComposition"
import { withCronAudit } from "@/app/api/lib/cron/withCronAudit"
import { getDefaultCronSlackCallback } from "@/app/api/lib/cron/cronSlackCallback"

/**
 * A cada 15 minutos: agenda a cadência do SDR para reuniões próximas e transforma os lembretes
 * vencidos (entrevista, reunião, vigência) em tarefa + alerta.
 */
export async function GET(request: NextRequest) {
  await connection()

  try {
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
      return NextResponse.json(new Output(false, [], ["Não autorizado"], null), { status: 401 })
    }

    const output = await withCronAudit(
      { cronKey: "follow-up-reminders", cronPath: "/api/v1/leads/cron/follow-up-reminders" },
      async () => {
        const nurture = await scheduleAutomaticFollowUpsUseCase.scheduleMeetingNurture()
        const processed = await processFollowUpRemindersUseCase.run()
        return new Output(processed.isValid, processed.successMessages, processed.errorMessages, {
          nurture: nurture.result,
          processed: processed.result,
        })
      },
      { onFailure: getDefaultCronSlackCallback() },
    )
    return NextResponse.json(output, { status: output.isValid ? 200 : 500 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[FollowUpRemindersCronRoute][GET] Erro:", error)
    return NextResponse.json(new Output(false, [], ["Erro interno no cron de lembretes"], null), { status: 500 })
  }
}
