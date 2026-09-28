import { connection, NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { backfillEmailDeliverabilityUseCase } from "@/app/api/useCases/email/BackfillEmailDeliverabilityUseCase"

export const maxDuration = 60

export async function GET(request: NextRequest) {
  await connection()
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json(new Output(false, [], ["Não autorizado"], null), { status: 401 })
  }
  const output = await backfillEmailDeliverabilityUseCase.execute()
  return NextResponse.json(output, { status: output.isValid ? 200 : 500 })
}
