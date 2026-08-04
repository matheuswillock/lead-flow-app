import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getRadarAccess } from "@/app/api/v1/radar/utils/getRadarAccess"
import { radarBaseImportUseCase } from "@/app/api/useCases/radar/RadarBaseImportUseCase"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024

export async function POST(request: NextRequest) {
  try {
    const radarAccess = await getRadarAccess(request)
    if (radarAccess.error) {
      return NextResponse.json(radarAccess.error, { status: radarAccess.status })
    }

    const formData = await request.formData().catch(() => null)
    if (!formData) {
      return NextResponse.json(new Output(false, [], ["Dados do formulário inválidos"], null), { status: 400 })
    }

    const file = formData.get("file")
    if (!file || typeof file === "string") {
      return NextResponse.json(new Output(false, [], ["Arquivo é obrigatório"], null), { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        new Output(false, [], ["Arquivo muito grande. Tamanho máximo: 10MB"], null),
        { status: 400 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const output = await radarBaseImportUseCase.uploadFile(buffer, file.name, radarAccess.access)
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[RadarImportUploadRoute][POST]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno ao processar arquivo"], null), { status: 500 })
  }
}
