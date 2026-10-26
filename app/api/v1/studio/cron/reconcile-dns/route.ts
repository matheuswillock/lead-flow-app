import { NextResponse, type NextRequest, connection } from "next/server"
import { Output } from "@/lib/output"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"
import { withCronAudit } from "@/app/api/lib/cron/withCronAudit"
import { getDefaultCronSlackCallback } from "@/app/api/lib/cron/cronSlackCallback"
import { studioDomainDnsAuditUseCase } from "@/app/api/useCases/studioDomainDnsAudit/StudioDomainDnsAuditUseCase"

export const maxDuration = 300

function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  return Boolean(cronSecret && request.headers.get("authorization") === `Bearer ${cronSecret}`)
}

export async function GET(request: NextRequest) {
  await connection()

  if (!isAuthorized(request)) {
    return NextResponse.json(new Output(false, [], ["Não autorizado"], null), { status: 401 })
  }

  console.info(JSON.stringify({ event: "studio_dns_reconciliation_started" }))

  try {
    const output = await withCronAudit(
      {
        cronKey: "studio-domain-dns-reconcile",
        cronPath: "/api/v1/studio/cron/reconcile-dns",
      },
      () => studioDomainDnsAuditUseCase.execute(),
      { onFailure: getDefaultCronSlackCallback() },
    )

    console.info(JSON.stringify({
      event: "studio_dns_reconciliation_finished",
      success: output.isValid,
      summary: output.isValid ? output.result : null,
    }))

    return NextResponse.json(output, { status: output.isValid ? 200 : 500 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[StudioDnsReconciliationCronRoute][GET] Falha na reconciliação", error)
    return NextResponse.json(
      new Output(false, [], ["Erro interno no cron de reconciliação DNS"], null),
      { status: 500 },
    )
  }
}
