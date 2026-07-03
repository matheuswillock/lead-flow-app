import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { backofficeContractUseCase } from "@/app/api/useCases/backofficeContract/BackofficeContractUseCase"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  try {
    const output = await backofficeContractUseCase.resolvePublicShareDownload(token)
    return NextResponse.json(output, { status: output.isValid ? 200 : 404 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[PublicContractShareDownloadRoute][GET]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
