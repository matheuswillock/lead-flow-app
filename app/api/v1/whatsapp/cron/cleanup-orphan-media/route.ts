import { NextRequest, NextResponse, connection } from "next/server";
import { Output } from "@/lib/output"
import { cleanupOrphanWhatsAppMediaUseCase } from "@/app/api/useCases/whatsapp/CleanupOrphanWhatsAppMediaUseCase"
import { resolveWhatsAppGlobalFeatureGate } from "@/lib/whatsapp/whatsapp-globally-enabled"
import { withCronAudit } from "@/app/api/lib/cron/withCronAudit"
import { getDefaultCronSlackCallback } from "@/app/api/lib/cron/cronSlackCallback"
import {
  buildSkippedCronOutput,
  CRON_SKIP_REASON_FEATURE_DISABLED,
} from "@/app/api/lib/cron/cronSkippedOutput"

async function handle(request: NextRequest) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json(new Output(false, [], ["Não autorizado"], null), { status: 401 })
  }

  const output = await withCronAudit(
    {
      cronKey: "cleanup-orphan-media",
      cronPath: "/api/v1/whatsapp/cron/cleanup-orphan-media",
    },
    async () => {
      const gate = await resolveWhatsAppGlobalFeatureGate()
      if (gate.status === "disabled") {
        return buildSkippedCronOutput(CRON_SKIP_REASON_FEATURE_DISABLED)
      }
      if (gate.status === "lookup_failed") {
        return new Output(
          false,
          [],
          ["Falha ao consultar feature flag global do WhatsApp"],
          null
        )
      }
      return cleanupOrphanWhatsAppMediaUseCase.execute()
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
