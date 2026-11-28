import { NextRequest, NextResponse } from "next/server"
import { assertProfileOwnership } from "@/app/api/v1/profiles/utils/assertProfileOwnership"
import { whatsappVerificationUseCase } from "@/app/api/useCases/bethania-verification/WhatsAppVerificationUseCase"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ supabaseId: string }> },
) {
  const { supabaseId } = await params
  const access = await assertProfileOwnership(request, supabaseId)
  if (access.error)
    return NextResponse.json(
      { error: "Não foi possível concluir a solicitação." },
      { status: access.status },
    )
  try {
    const body = await request.json()
    const output = await whatsappVerificationUseCase.execute({
      action: "request-code",
      supabaseId: access.supabaseId,
      phone: body?.phone,
    })
    const payload = output.isValid
      ? { success: true, challengeId: output.result.challengeId }
      : { error: output.errorMessages[0] ?? "Não foi possível concluir a solicitação." }
    return NextResponse.json(payload, { status: output.result.status })
  } catch {
    return NextResponse.json({ error: "Não foi possível concluir a solicitação." }, { status: 500 })
  }
}
