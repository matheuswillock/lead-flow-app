import { NextResponse, type NextRequest, connection } from "next/server"
import { Output } from "@/lib/output"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"
import { withCronAudit } from "@/app/api/lib/cron/withCronAudit"
import { getDefaultCronSlackCallback } from "@/app/api/lib/cron/cronSlackCallback"
import { drainEmailOrphanEventsUseCase } from "@/app/api/useCases/email/DrainEmailOrphanEventsUseCase"

export const maxDuration = 300

/**
 * Dreno dedicado dos eventos órfãos do Resend (evento chegou antes do
 * `EmailLog` existir). Antes o dreno pegava carona no fim do
 * `dispatch-scheduled`, 10 por execução — 120/h, insuficiente para a vazão
 * real. Aqui são 200 a cada 5 minutos: 2.400/h.
 */
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
        cronKey: "email-orphan-events-drain",
        cronPath: "/api/v1/email/cron/drain-orphan-events",
      },
      async () => drainEmailOrphanEventsUseCase.execute(),
      {
        onFailure: getDefaultCronSlackCallback(),
      },
    )

    return NextResponse.json(result, { status: result.isValid ? 200 : 500 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[EmailCronDrainOrphanEventsRoute][GET]", error)
    return NextResponse.json(
      new Output(false, [], ["Erro interno no dreno de eventos órfãos do Resend"], null),
      { status: 500 },
    )
  }
}
