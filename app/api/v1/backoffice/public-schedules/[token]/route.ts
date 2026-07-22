import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"
import { backofficeScheduleShareUseCase } from "@/app/api/useCases/backofficeScheduleShare/BackofficeScheduleShareUseCase"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    if (!token?.trim()) {
      return NextResponse.json(
        new Output(false, [], ["Token de agendamento inválido"], null),
        { status: 400 }
      )
    }

    const output = await backofficeScheduleShareUseCase.getPublicShare(token)
    return NextResponse.json(output, { status: output.isValid ? 200 : 404 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficePublicScheduleRoute][GET]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
