import { NextRequest, NextResponse } from "next/server"
import { Output } from "@/lib/output"
import { processWhatsAppWebhookOutboxUseCase } from "@/app/api/useCases/whatsapp/ProcessWhatsAppWebhookOutboxUseCase"
import { isWhatsAppGloballyEnabled } from "@/lib/whatsapp/whatsapp-globally-enabled"

async function handle(request: NextRequest) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json(new Output(false, [], ["Não autorizado"], null), { status: 401 })
  }
  if (!(await isWhatsAppGloballyEnabled())) {
    return NextResponse.json({ skipped: true }, { status: 200 })
  }
  const output = await processWhatsAppWebhookOutboxUseCase.recover()
  return NextResponse.json(output, { status: output.isValid ? 200 : 500 })
}

export async function GET(request: NextRequest) {
  return handle(request)
}

export async function POST(request: NextRequest) {
  return handle(request)
}
