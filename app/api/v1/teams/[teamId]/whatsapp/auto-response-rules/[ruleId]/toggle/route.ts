import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { Output } from "@/lib/output"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { whatsAppAutoResponseRuleUseCase } from "@/app/api/useCases/whatsapp/WhatsAppAutoResponseRuleUseCase"

const toggleSchema = z.object({
  isActive: z.boolean(),
})

function resolveStatus(output: Output): number {
  const msg = output.errorMessages.join(" ")
  if (msg.includes("não encontrad")) return 404
  if (msg.includes("não está ativo") || msg.includes("Apenas gestores")) return 403
  return 400
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; ruleId: string }> }
) {
  const { teamId, ruleId } = await params
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

  const parsed = toggleSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      new Output(false, [], parsed.error.issues.map((issue) => issue.message), null),
      { status: 400 }
    )
  }

  const output = await whatsAppAutoResponseRuleUseCase.toggle({
    teamId,
    ruleId,
    isActive: parsed.data.isActive,
    callerIsMaster: teamAccess.access.isMaster,
    callerRole: teamAccess.access.teamMember.role,
  })

  if (!output.isValid) {
    return NextResponse.json(output, { status: resolveStatus(output) })
  }

  return NextResponse.json(output)
}
