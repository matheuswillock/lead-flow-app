import { NextRequest, NextResponse } from "next/server"
import { Output } from "@/lib/output"
import { processWhatsAppContactSyncJobsUseCase } from "@/app/api/useCases/whatsapp/ProcessWhatsAppContactSyncJobsUseCase"
import { resolveWhatsAppGlobalFeatureGate } from "@/lib/whatsapp/whatsapp-globally-enabled"
import { withCronAudit } from "@/app/api/lib/cron/withCronAudit"
import { getDefaultCronSlackCallback } from "@/app/api/lib/cron/cronSlackCallback"

async function handle(request: NextRequest) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json(new Output(false, [], ["Não autorizado"], null), { status: 401 })
  }

  const gate = await resolveWhatsAppGlobalFeatureGate()
  if (gate.status === "disabled") {
    return NextResponse.json({ skipped: true }, { status: 200 })
  }

  const output = await withCronAudit(
    {
      cronKey: "sync-contacts",
      cronPath: "/api/v1/whatsapp/cron/sync-contacts",
    },
    async () => {
      if (gate.status === "lookup_failed") {
        return new Output(
          false,
          [],
          ["Falha ao consultar feature flag global do WhatsApp"],
          null
        )
      }
      return processWhatsAppContactSyncJobsUseCase.execute()
    },
    {
      onFailure: getDefaultCronSlackCallback(),
    }
  )

  return NextResponse.json(output, { status: output.isValid ? 200 : 500 })
}

export const GET = handle
export const POST = handle
