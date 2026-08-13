import { NextRequest, NextResponse, connection } from "next/server";
import { Output } from "@/lib/output"
import { processWhatsAppMediaIngestUseCase } from "@/app/api/useCases/whatsapp/ProcessWhatsAppMediaIngestUseCase"
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
      cronKey: "ingest-media",
      cronPath: "/api/v1/whatsapp/cron/ingest-media",
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
      return processWhatsAppMediaIngestUseCase.execute(20)
    },
    {
      onFailure: getDefaultCronSlackCallback(),
    }
  )

  return NextResponse.json(output, { status: output.isValid ? 200 : 500 })
}

export async function GET(request: NextRequest) {
  await connection();

  return handle(request)
}

export async function POST(request: NextRequest) {
  return handle(request)
}
