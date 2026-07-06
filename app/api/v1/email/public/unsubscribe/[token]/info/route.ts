import { NextResponse, type NextRequest } from "next/server"
import { EmailUnsubscribeUseCase } from "@/app/api/useCases/email/EmailUnsubscribeUseCase"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const useCase = new EmailUnsubscribeUseCase()
    const output = await useCase.getInfo(token)
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[EmailPublicUnsubscribeInfoRoute][GET]", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
