import { NextResponse, connection, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { reconcileTeamFormDomainStatusUseCase } from "@/app/api/useCases/email/ReconcileTeamFormDomainStatusUseCase"
import { withCronAudit } from "@/app/api/lib/cron/withCronAudit"
import { getDefaultCronSlackCallback } from "@/app/api/lib/cron/cronSlackCallback"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"

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
        cronKey: "email-form-domain-status-reconcile",
        cronPath: "/api/v1/email/cron/reconcile-form-domain-status",
      },
      async () => reconcileTeamFormDomainStatusUseCase.execute(),
      { onFailure: getDefaultCronSlackCallback() },
    )

    return NextResponse.json(result, { status: result.isValid ? 200 : 500 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[ReconcileFormDomainStatusCronRoute][GET]", error)
    return NextResponse.json(
      new Output(false, [], ["Erro interno no cron de reconciliação de domínio de formulários"], null),
      { status: 500 },
    )
  }
}
