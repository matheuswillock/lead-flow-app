import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { Output } from "@/lib/output"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { whatsAppAutoResponseRuleUseCase } from "@/app/api/useCases/whatsapp/WhatsAppAutoResponseRuleUseCase"
import { isManagerLikeRole } from "@/lib/roles"
import { offHoursScheduleSchema } from "@/lib/whatsapp/off-hours-schedule"

const createRuleSchema = z.object({
  type: z.enum(["WELCOME", "OFF_HOURS", "KEYWORD"]),
  replyMessage: z.string().min(1, "Mensagem de resposta é obrigatória"),
  triggerKeywords: z.array(z.string()).optional(),
  matchMode: z.enum(["CONTAINS", "EXACT", "STARTS_WITH"]).optional(),
  offHoursSchedule: offHoursScheduleSchema.optional(),
  isActive: z.boolean().optional(),
  priority: z.number().int().optional(),
})

function resolveStatus(output: Output): number {
  const msg = output.errorMessages.join(" ")
  if (msg.includes("não encontrad")) return 404
  if (msg.includes("não está ativo") || msg.includes("Apenas gestores")) return 403
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

  const { access } = teamAccess
  const output = await whatsAppAutoResponseRuleUseCase.list({
    teamId,
    callerIsMaster: access.isMaster,
    callerRole: access.teamMember.role,
  })

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

  if (!teamAccess.access.isMaster && !isManagerLikeRole(teamAccess.access.teamMember.role)) {
    return NextResponse.json(
      new Output(false, [], ["Apenas gestores podem gerenciar auto-respostas"], null),
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

  const parsed = createRuleSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      new Output(false, [], parsed.error.issues.map((issue) => issue.message), null),
      { status: 400 }
    )
  }

  const output = await whatsAppAutoResponseRuleUseCase.create({
    teamId,
    callerIsMaster: teamAccess.access.isMaster,
    callerRole: teamAccess.access.teamMember.role,
    type: parsed.data.type,
    replyMessage: parsed.data.replyMessage,
    triggerKeywords: parsed.data.triggerKeywords,
    matchMode: parsed.data.matchMode,
    offHoursSchedule: parsed.data.offHoursSchedule,
    isActive: parsed.data.isActive,
    priority: parsed.data.priority,
  })

  if (!output.isValid) {
    return NextResponse.json(output, { status: resolveStatus(output) })
  }

  return NextResponse.json(output, { status: 201 })
}
