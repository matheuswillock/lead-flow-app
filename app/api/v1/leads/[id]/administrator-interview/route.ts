import { NextRequest, NextResponse, connection } from "next/server"
import { z } from "zod"
import { Output } from "@/lib/output"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { leadAdministratorInterviewUseCase } from "@/app/api/useCases/leadAdministratorInterview/leadAdministratorInterviewComposition"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"
import { interviewServerError, interviewStatusOf, resolveInterviewWriteAccess } from "./interviewAccess"

type Params = { params: Promise<{ id: string }> }

const saveSchema = z.object({
  scheduledAt: z.string().min(1),
  scheduledLocal: z.string().min(1),
  administratorName: z.string().max(120).nullish(),
  notes: z.string().max(1000).nullish(),
  reminderOffsets: z.array(z.string()).max(3).optional(),
})

export async function GET(request: NextRequest, { params }: Params) {
  await connection()
  try {
    const teamAccess = await getTeamAccess(request)
    if (teamAccess.error) return NextResponse.json(teamAccess.error, { status: teamAccess.status })
    const { id } = await params
    const output = await leadAdministratorInterviewUseCase.get(id, teamAccess.access.teamId)
    return NextResponse.json(output, { status: interviewStatusOf(output) })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    return interviewServerError(error, "GET")
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const resolved = await resolveInterviewWriteAccess(request)
    if (resolved.response) return resolved.response
    const parsed = saveSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(new Output(false, [], ["Dados da entrevista inválidos"], null), { status: 400 })
    }
    const { id } = await params
    const output = await leadAdministratorInterviewUseCase.save({ leadId: id, ...resolved.access, ...parsed.data })
    return NextResponse.json(output, { status: interviewStatusOf(output) })
  } catch (error) {
    return interviewServerError(error, "PUT")
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const resolved = await resolveInterviewWriteAccess(request)
    if (resolved.response) return resolved.response
    const { id } = await params
    const output = await leadAdministratorInterviewUseCase.remove({ leadId: id, ...resolved.access })
    return NextResponse.json(output, { status: interviewStatusOf(output) })
  } catch (error) {
    return interviewServerError(error, "DELETE")
  }
}
