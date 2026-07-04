import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { Output } from "@/lib/output"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { invalidateLeadCache } from "@/lib/cache/invalidation"
import { createLeadFromConversationUseCase } from "@/app/api/useCases/whatsapp/CreateLeadFromConversationUseCase"

const createLeadSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  phone: z
    .string()
    .min(10, "Telefone deve ter pelo menos 10 dígitos")
    .nullish()
    .transform((val) => val || undefined),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; conversationId: string }> }
) {
  const { teamId, conversationId } = await params
  const teamAccess = await getTeamAccess(request)
  if ("error" in teamAccess) {
    return NextResponse.json(teamAccess.error, { status: teamAccess.status })
  }

  if (teamAccess.access.teamId !== teamId) {
    return NextResponse.json(
      new Output(false, [], ["Acesso negado a este time"], null),
      { status: 403 }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      new Output(false, [], ["Corpo da requisição inválido"], null),
      { status: 400 }
    )
  }

  const parsed = createLeadSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      new Output(false, [], parsed.error.issues.map((i) => i.message), null),
      { status: 400 }
    )
  }

  const output = await createLeadFromConversationUseCase.execute({
    conversationId,
    name: parsed.data.name,
    phone: parsed.data.phone,
    access: teamAccess.access,
  })

  if (!output.isValid) {
    const status = output.errorMessages.some((m) => m.includes("já possui"))
      ? 409
      : output.errorMessages.some((m) => m.includes("Acesso negado") || m.includes("não encontrad"))
        ? 403
        : 400
    return NextResponse.json(output, { status })
  }

  const result = output.result as { leadId?: string } | null
  if (result?.leadId) {
    invalidateLeadCache({ leadId: result.leadId, teamId })
  }

  return NextResponse.json(output, { status: 201 })
}
