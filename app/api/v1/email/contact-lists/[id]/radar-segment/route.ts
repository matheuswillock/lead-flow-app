import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { Output } from "@/lib/output"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { EmailContactListUseCase } from "@/app/api/useCases/email/EmailContactListUseCase"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"

const patchSchema = z.object({
  segmentId: z.string().uuid().nullable(),
})

function makeUseCase() {
  return new EmailContactListUseCase()
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const teamAccess = await getTeamAccess(request)
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status })
    }

    const body = await request.json()
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        new Output(false, [], ["Dados inválidos: segmentId deve ser um UUID ou null"], null),
        { status: 400 }
      )
    }

    const useCase = makeUseCase()
    const output = await useCase.setRadarSegment(id, parsed.data.segmentId, teamAccess.access)
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[EmailContactListRadarSegmentRoute][PATCH]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
