import { NextRequest, NextResponse } from "next/server"
import { whatsAppRepository } from "@/app/api/infra/data/repositories/whatsapp/WhatsAppRepository"
import { processEvoWebhookUseCase } from "@/app/api/useCases/whatsapp/ProcessEvoWebhookUseCase"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamToken: string }> }
) {
  const { teamToken } = await params

  const config = await whatsAppRepository.findConfigByWebhookSecret(teamToken)
  if (!config) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let rawEvent: unknown
  try {
    rawEvent = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  const output = await processEvoWebhookUseCase.execute({
    teamId: config.teamId,
    configId: config.id,
    rawEvent,
  })

  if (!output.isValid) {
    console.error(
      "[WhatsAppEvoWebhookRoute][POST] processing failed",
      output.errorMessages
    )
    return NextResponse.json({ processed: false }, { status: 200 })
  }

  return NextResponse.json({ processed: true }, { status: 200 })
}
