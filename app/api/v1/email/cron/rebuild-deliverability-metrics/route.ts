import { connection, NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { rebuildEmailDeliverabilityMetricsUseCase } from "@/app/api/useCases/email/RebuildEmailDeliverabilityMetricsUseCase"

export const maxDuration = 60

export async function GET(request: NextRequest) {
  await connection()
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json(new Output(false, [], ["Não autorizado"], null), { status: 401 })
  }
  const output = await rebuildEmailDeliverabilityMetricsUseCase.execute()
  return NextResponse.json(output, { status: output.isValid ? 200 : 500 })
}
