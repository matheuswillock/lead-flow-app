import { NextResponse, type NextRequest, connection } from "next/server"
import { Output } from "@/lib/output"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"
import { withCronAudit } from "@/app/api/lib/cron/withCronAudit"
import { getDefaultCronSlackCallback } from "@/app/api/lib/cron/cronSlackCallback"
import { getPaymentProviderMaintenanceUseCase } from "@/app/api/useCases/paymentProviderPayment/paymentProviderPaymentComposition"

export const maxDuration = 60

export async function GET(request: NextRequest) {
  await connection()

  try {
    const authHeader = request.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(new Output(false, [], ["Não autorizado"], null), { status: 401 })
    }

    let limit: number | undefined
    try {
      limit = readLimit(request.nextUrl.searchParams.get("limit"))
    } catch {
      return NextResponse.json(new Output(false, [], ["Limite de manutenção inválido"], null), {
        status: 400,
      })
    }
    const output = await withCronAudit(
      {
        cronKey: "payment-provider-maintenance",
        cronPath: "/api/v1/payment-provider/cron/maintenance",
      },
      async () => (await getPaymentProviderMaintenanceUseCase()).execute({ limit }),
      { onFailure: getDefaultCronSlackCallback() },
    )
    return NextResponse.json(output, { status: output.isValid ? 200 : 500 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[PaymentProviderMaintenanceCronRoute][GET]", {
      message: error instanceof Error ? error.message : "unknown",
    })
    return NextResponse.json(
      new Output(false, [], ["Erro interno na manutenção de pagamentos"], null),
      {
        status: 500,
      },
    )
  }
}

function readLimit(rawLimit: string | null): number | undefined {
  if (rawLimit === null) return undefined
  const limit = Number(rawLimit)
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
    throw new Error("Limite de manutenção inválido")
  }
  return limit
}
