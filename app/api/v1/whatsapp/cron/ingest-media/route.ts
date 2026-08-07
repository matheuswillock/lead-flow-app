import { NextRequest, NextResponse, connection } from "next/server";
import { Output } from "@/lib/output"
import { processWhatsAppMediaIngestUseCase } from "@/app/api/useCases/whatsapp/ProcessWhatsAppMediaIngestUseCase"

async function handle(request: NextRequest) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json(new Output(false, [], ["Não autorizado"], null), { status: 401 })
  }
  const output = await processWhatsAppMediaIngestUseCase.execute(20)
  return NextResponse.json(output, { status: output.isValid ? 200 : 500 })
}

export async function GET(request: NextRequest) {
  await connection();

  return handle(request)
}

export async function POST(request: NextRequest) {
  return handle(request)
}
