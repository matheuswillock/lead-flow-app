import { NextResponse, type NextRequest } from "next/server"
import { EmailUnsubscribeUseCase } from "@/app/api/useCases/email/EmailUnsubscribeUseCase"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { token?: string }
    const token = body.token ?? request.nextUrl.searchParams.get("token")
    if (!token) {
      return NextResponse.json({ error: "Token obrigatório" }, { status: 400 })
    }

    const useCase = new EmailUnsubscribeUseCase()
    const output = await useCase.unsubscribe(token)
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[EmailPublicUnsubscribeRoute][POST]", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
