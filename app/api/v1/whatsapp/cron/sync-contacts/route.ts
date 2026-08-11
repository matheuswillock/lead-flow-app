import { NextRequest, NextResponse } from "next/server"
import { Output } from "@/lib/output"
import { processWhatsAppContactSyncJobsUseCase } from "@/app/api/useCases/whatsapp/ProcessWhatsAppContactSyncJobsUseCase"
import { isWhatsAppGloballyEnabled } from "@/lib/whatsapp/whatsapp-globally-enabled"
import { withCronAudit } from "@/app/api/lib/cron/withCronAudit"
import { getDefaultCronSlackCallback } from "@/app/api/lib/cron/cronSlackCallback"

async function handle(request: NextRequest) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json(new Output(false, [], ["Não autorizado"], null), { status: 401 })
  }
  if (!(await isWhatsAppGloballyEnabled())) {
    return NextResponse.json({ skipped: true }, { status: 200 })
  }
  
  const output = await withCronAudit(
    {
      cronKey: "sync-contacts",
      cronPath: "/api/v1/whatsapp/cron/sync-contacts",
    },
    () => processWhatsAppContactSyncJobsUseCase.execute(),
    {
      onFailure: getDefaultCronSlackCallback(),
    }
  )
  
  return NextResponse.json(output, { status: output.isValid ? 200 : 500 })
}

export const GET = handle
export const POST = handle
