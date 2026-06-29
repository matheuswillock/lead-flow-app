import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { Output } from "@/lib/output"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { EmailTeamVariablesUseCase } from "@/app/api/useCases/email/EmailTeamVariablesUseCase"
import { isManagerLikeRole } from "@/lib/roles"
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';

const variableSchema = z.object({
  key: z.string().min(1).max(60),
  type: z.enum(["string", "number"]).optional(),
  defaultValue: z.string().max(500).nullable().optional(),
  description: z.string().max(280).nullable().optional(),
  isActive: z.boolean().optional(),
  valueSource: z.enum(["STATIC", "CDP"]).optional(),
  cdpFieldKey: z.string().max(120).nullable().optional(),
})

function makeUseCase() {
  return new EmailTeamVariablesUseCase()
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ variableId: string }> }) {
  try {
    const { variableId } = await params
    const teamAccess = await getTeamAccess(request)
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status })
    }

    if (!isManagerLikeRole(teamAccess.access.teamMember.role)) {
      return NextResponse.json(
        new Output(false, [], ["Apenas managers podem editar variáveis globais"], null),
        { status: 403 }
      )
    }

    const body = await request.json().catch(() => null)
    const validation = variableSchema.safeParse(body)
    if (!validation.success) {
      const errors = validation.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`)
      return NextResponse.json(new Output(false, [], errors, null), { status: 400 })
    }

    const useCase = makeUseCase()
    const output = await useCase.update(variableId, validation.data, teamAccess.access)
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[EmailSettingsVariableByIdRoute][PATCH]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ variableId: string }> }) {
  try {
    const { variableId } = await params
    const teamAccess = await getTeamAccess(request)
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status })
    }

    if (!isManagerLikeRole(teamAccess.access.teamMember.role)) {
      return NextResponse.json(
        new Output(false, [], ["Apenas managers podem remover variáveis globais"], null),
        { status: 403 }
      )
    }

    const useCase = makeUseCase()
    const output = await useCase.delete(variableId, teamAccess.access)
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[EmailSettingsVariableByIdRoute][DELETE]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
