import { NextResponse, type NextRequest, connection } from "next/server"
import { Output } from "@/lib/output"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"
import { withCronAudit } from "@/app/api/lib/cron/withCronAudit"
import { getDefaultCronSlackCallback } from "@/app/api/lib/cron/cronSlackCallback"
import { paymentProviderHealthSweepUseCase } from "@/app/api/useCases/paymentProviderConfig/paymentProviderConfigComposition"

export const maxDuration = 60

export async function GET(request: NextRequest) {
  await connection()

  try {
    const authHeader = request.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(new Output(false, [], ["Não autorizado"], null), { status: 401 })
    }

    const output = await withCronAudit(
      {
        cronKey: "payment-provider-health-check",
        cronPath: "/api/v1/payment-provider/cron/health-check",
      },
      () => paymentProviderHealthSweepUseCase.execute(),
      { onFailure: getDefaultCronSlackCallback() },
    )
    return NextResponse.json(output, { status: output.isValid ? 200 : 500 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[PaymentProviderHealthCheckCronRoute][GET]", {
      message: error instanceof Error ? error.name : "unknown",
    })
    return NextResponse.json(
      new Output(false, [], ["Erro interno no health-check de pagamentos"], null),
      { status: 500 },
    )
  }
}
