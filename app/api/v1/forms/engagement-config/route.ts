import { NextResponse, type NextRequest, connection } from "next/server";
import { Output } from "@/lib/output"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { getFormsEngagementConfigUseCase } from "@/app/api/useCases/forms/GetFormsEngagementConfigUseCase"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"

export async function GET(request: NextRequest) {
  await connection();

  try {
    const teamAccess = await getTeamAccess(request)
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status })
    }

    const output = await getFormsEngagementConfigUseCase.execute()
    const response = NextResponse.json(output, { status: output.isValid ? 200 : 400 })
    if (output.isValid) {
      // `private`, nao `public`: esta rota passa por getTeamAccess e o proxy
      // anexa cookie de sessao na resposta (rewriteWithSession ->
      // copySessionCookies). Com `public`, um cache compartilhado poderia
      // guardar essa resposta com o Set-Cookie de um usuario e servi-la a
      // outro. O corpo em si e configuracao global, mas o cabecalho nao e.
      response.headers.set(
        "Cache-Control",
        "private, max-age=300, stale-while-revalidate=60"
      )
    }
    return response
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[FormsEngagementConfigRoute][GET]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
