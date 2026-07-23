import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { Output } from "@/lib/output"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { createWhatsAppConfigUseCase } from "@/app/api/useCases/whatsapp/CreateWhatsAppConfigUseCase"
import { getWhatsAppConfigUseCase } from "@/app/api/useCases/whatsapp/GetWhatsAppConfigUseCase"

const createConfigSchema = z.object({
  usageLimitMonthly: z.number().int().positive().optional(),
  reuseFromTeamId: z.string().uuid().optional(),
})

function resolveStatus(output: Output): number {
  const msg = output.errorMessages.join(" ")
  if (msg.includes("não encontrad")) return 404
  if (msg.includes("já existe")) return 409
  if (msg.includes("já está conectado") || msg.includes("já possui outro número")) return 409
  if (
    msg.includes("autorização") ||
    msg.includes("acesso negado") ||
    msg.includes("gestores") ||
    msg.includes("não está ativo")
  ) {
    return 403
  }
  if (msg.includes("Erro interno") || msg.includes("inesperado")) return 500
  return 400
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params
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

  const output = await getWhatsAppConfigUseCase.execute(teamId)
  if (!output.isValid) {
    return NextResponse.json(output, { status: resolveStatus(output) })
  }

  return NextResponse.json(output)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params
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
    body = {}
  }

  const parsed = createConfigSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      new Output(false, [], parsed.error.issues.map((issue) => issue.message), null),
      { status: 400 }
    )
  }

  const output = await createWhatsAppConfigUseCase.execute({
    teamId,
    profileId: teamAccess.access.profileId,
    callerIsMaster: teamAccess.access.isMaster,
    callerRole: teamAccess.access.teamMember.role,
    usageLimitMonthly: parsed.data.usageLimitMonthly,
    reuseFromTeamId: parsed.data.reuseFromTeamId,
  })

  if (!output.isValid) {
    return NextResponse.json(output, { status: resolveStatus(output) })
  }

  return NextResponse.json(output, { status: 201 })
}
