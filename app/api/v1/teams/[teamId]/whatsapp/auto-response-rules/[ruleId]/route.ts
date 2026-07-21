import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { Output } from "@/lib/output"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { whatsAppAutoResponseRuleUseCase } from "@/app/api/useCases/whatsapp/WhatsAppAutoResponseRuleUseCase"
import { offHoursScheduleSchema } from "@/lib/whatsapp/off-hours-schedule"

const updateRuleSchema = z.object({
  replyMessage: z.string().min(1).optional(),
  triggerKeywords: z.array(z.string()).optional(),
  matchMode: z.enum(["CONTAINS", "EXACT", "STARTS_WITH"]).optional(),
  offHoursSchedule: offHoursScheduleSchema.nullable().optional(),
  isActive: z.boolean().optional(),
  priority: z.number().int().optional(),
})

function resolveStatus(output: Output): number {
  const msg = output.errorMessages.join(" ")
  if (msg.includes("não encontrad")) return 404
  if (msg.includes("não está ativo") || msg.includes("Apenas gestores")) return 403
  return 400
}

export async function PATCH(
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

  const parsed = updateRuleSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      new Output(false, [], parsed.error.issues.map((issue) => issue.message), null),
      { status: 400 }
    )
  }

  const output = await whatsAppAutoResponseRuleUseCase.update({
    teamId,
    ruleId,
    callerIsMaster: teamAccess.access.isMaster,
    callerRole: teamAccess.access.teamMember.role,
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

  return NextResponse.json(output)
}

export async function DELETE(
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

  const output = await whatsAppAutoResponseRuleUseCase.delete({
    teamId,
    ruleId,
    callerIsMaster: teamAccess.access.isMaster,
    callerRole: teamAccess.access.teamMember.role,
  })

  if (!output.isValid) {
    return NextResponse.json(output, { status: resolveStatus(output) })
  }

  return NextResponse.json(output)
}
