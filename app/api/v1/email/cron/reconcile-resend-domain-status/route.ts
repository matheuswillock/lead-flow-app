import { NextResponse, type NextRequest, connection } from "next/server"
import { Output } from "@/lib/output"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"
import { withCronAudit } from "@/app/api/lib/cron/withCronAudit"
import { getDefaultCronSlackCallback } from "@/app/api/lib/cron/cronSlackCallback"
import { reconcileResendDomainStatusUseCase } from "@/app/api/useCases/email/ReconcileResendDomainStatusUseCase"

// Reconciliação é sequencial por domínio (~4s cada) — o rate limit do provider é
// compartilhado com envios reais, por isso não paraleliza. Com 13 domínios já
// beirava os 60s e a plataforma matava o processo (stale_running_timeout 3x em
// 10-11/09). 300s dá margem linear para ~75 domínios.
export const maxDuration = 300

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
        cronKey: "email-resend-domain-status-reconcile",
        cronPath: "/api/v1/email/cron/reconcile-resend-domain-status",
      },
      async () => reconcileResendDomainStatusUseCase.execute(),
      {
        onFailure: getDefaultCronSlackCallback(),
      }
    )

    return NextResponse.json(result, { status: result.isValid ? 200 : 500 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[EmailCronReconcileResendDomainStatusRoute][GET]", error)
    return NextResponse.json(
      new Output(false, [], ["Erro interno no cron de reconciliação de domínio Resend"], null),
      { status: 500 }
    )
  }
}
