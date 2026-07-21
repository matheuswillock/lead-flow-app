import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { isManagerLikeRole } from "@/lib/roles"
import { xPostEmbedUseCase } from "@/app/api/useCases/email/XPostEmbedUseCase"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"

export async function POST(request: NextRequest) {
  try {
    const teamAccess = await getTeamAccess(request)
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status })
    }

    if (!isManagerLikeRole(teamAccess.access.teamMember.role)) {
      return NextResponse.json(
        new Output(false, [], ["Apenas managers podem gerar embeds de post do X"], null),
        { status: 403 }
      )
    }

    const body = (await request.json().catch(() => null)) as { url?: string } | null
    const url = body?.url?.trim()
    if (!url) {
      return NextResponse.json(new Output(false, [], ["URL do post é obrigatória"], null), {
        status: 400,
      })
    }

    const result = await xPostEmbedUseCase.execute(url)
    return NextResponse.json(result, { status: result.isValid ? 200 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[EmailTemplateXPostEmbedRoute][POST]", error)
    return NextResponse.json(
      new Output(false, [], ["Erro interno ao gerar embed do post do X"], null),
      { status: 500 }
    )
  }
}
