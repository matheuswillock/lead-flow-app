import { shortLinkUseCase } from "@/app/api/useCases/shortLink/ShortLinkUseCase"
import { Output } from "@/lib/output"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const schema = z.object({
  targetUrl: z.string().url("URL inválida."),
})

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const teamAccess = await getTeamAccess(request)
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status })
    }

    const payload = await request.json().catch(() => null)
    const validation = schema.safeParse(payload)

    if (!validation.success) {
      const output = new Output(
        false,
        [],
        validation.error.issues.map((i) => i.message),
        null
      )
      return NextResponse.json(output, { status: 400 })
    }

    const output = await shortLinkUseCase.getOrCreate(validation.data.targetUrl)
    return NextResponse.json(output, { status: output.isValid ? 200 : 500 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[ShortLinksRoute][POST]", error)
    const output = new Output(false, [], ["Erro ao encurtar link."], null)
    return NextResponse.json(output, { status: 500 })
  }
}
