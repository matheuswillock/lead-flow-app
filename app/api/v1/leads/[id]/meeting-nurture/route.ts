import { NextRequest, NextResponse, connection } from "next/server"
import { z } from "zod"
import { Output } from "@/lib/output"
import { getTeamAccess, hasLeadActivityAccess } from "@/app/api/v1/utils/teamAccess"
import { leadMeetingNurtureUseCase } from "@/app/api/useCases/leadFollowUp/leadFollowUpComposition"
import { NURTURE_LEAD_NOT_FOUND } from "@/app/api/useCases/leadFollowUp/LeadMeetingNurtureUseCase"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"

type Params = { params: Promise<{ id: string }> }

const addSchema = z.object({ dueAt: z.string().min(1) })
const removeSchema = z.object({ contactId: z.string().uuid() })

function statusOf(output: Output) {
  if (output.isValid) return 200
  return output.errorMessages.includes(NURTURE_LEAD_NOT_FOUND) ? 404 : 400
}

function serverError(error: unknown, method: string) {
  rethrowIfPrerenderInterrupted(error)
  console.error(`[LeadMeetingNurtureRoute][${method}]`, error)
  return NextResponse.json(new Output(false, [], ["Erro interno do servidor"], null), { status: 500 })
}

async function resolveWriteAccess(request: NextRequest) {
  const teamAccess = await getTeamAccess(request)
  if (teamAccess.error) return { response: NextResponse.json(teamAccess.error, { status: teamAccess.status }) }
  if (!hasLeadActivityAccess(teamAccess.access.teamMember)) {
    const output = new Output(false, [], ["Acesso negado para alterar a nutrição deste lead."], null)
    return { response: NextResponse.json(output, { status: 403 }) }
  }
  return { teamId: teamAccess.access.teamId }
}

/** Contatos de nutrição até a reunião (cadência fixa + extras do SDR). */
export async function GET(request: NextRequest, { params }: Params) {
  await connection()
  try {
    const teamAccess = await getTeamAccess(request)
    if (teamAccess.error) return NextResponse.json(teamAccess.error, { status: teamAccess.status })
    const { id } = await params
    const output = await leadMeetingNurtureUseCase.list({ leadId: id, teamId: teamAccess.access.teamId })
    return NextResponse.json(output, { status: statusOf(output) })
  } catch (error) {
    return serverError(error, "GET")
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const resolved = await resolveWriteAccess(request)
    if (resolved.response) return resolved.response
    const parsed = addSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json(new Output(false, [], ["Informe a data e a hora"], null), { status: 400 })
    const { id } = await params
    const output = await leadMeetingNurtureUseCase.addContact({ leadId: id, teamId: resolved.teamId, dueAt: parsed.data.dueAt })
    return NextResponse.json(output, { status: statusOf(output) })
  } catch (error) {
    return serverError(error, "POST")
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const resolved = await resolveWriteAccess(request)
    if (resolved.response) return resolved.response
    const parsed = removeSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json(new Output(false, [], ["Contato inválido"], null), { status: 400 })
    const { id } = await params
    const output = await leadMeetingNurtureUseCase.removeContact({
      leadId: id,
      teamId: resolved.teamId,
      contactId: parsed.data.contactId,
    })
    return NextResponse.json(output, { status: statusOf(output) })
  } catch (error) {
    return serverError(error, "DELETE")
  }
}
