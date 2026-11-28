import { NextRequest, NextResponse } from "next/server"
import { assertProfileOwnership } from "@/app/api/v1/profiles/utils/assertProfileOwnership"
import { whatsappVerificationUseCase } from "@/app/api/useCases/bethania-verification/WhatsAppVerificationUseCase"

export async function POST(request: NextRequest, { params }: { params: Promise<{ supabaseId: string }> }) {
  const { supabaseId } = await params
  const access = await assertProfileOwnership(request, supabaseId)
  if (access.error) return NextResponse.json({ error: "Código inválido ou expirado." }, { status: access.status })
  try {
    const body = await request.json()
    const output = await whatsappVerificationUseCase.execute({
      action: "verify-code",
      supabaseId: access.supabaseId,
      challengeId: body?.challengeId,
      code: body?.code,
    })
    return NextResponse.json(
      output.isValid ? { success: true } : { error: output.errorMessages[0] ?? "Código inválido ou expirado." },
      { status: output.result.status },
    )
  } catch {
    return NextResponse.json({ error: "Código inválido ou expirado." }, { status: 400 })
  }
}
