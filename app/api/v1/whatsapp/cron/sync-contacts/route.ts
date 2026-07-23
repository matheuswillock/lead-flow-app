import { NextRequest, NextResponse } from "next/server"
import { Output } from "@/lib/output"
import { processWhatsAppContactSyncJobsUseCase } from "@/app/api/useCases/whatsapp/ProcessWhatsAppContactSyncJobsUseCase"

async function handle(request: NextRequest) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json(new Output(false, [], ["Não autorizado"], null), { status: 401 })
  }
  const output = await processWhatsAppContactSyncJobsUseCase.execute()
  return NextResponse.json(output, { status: output.isValid ? 200 : 500 })
}

export const GET = handle
export const POST = handle
