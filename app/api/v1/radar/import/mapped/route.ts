import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { Output } from "@/lib/output"
import { getRadarAccess } from "@/app/api/v1/radar/utils/getRadarAccess"
import { radarBaseImportUseCase } from "@/app/api/useCases/radar/RadarBaseImportUseCase"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"

const MappedRadarImportSchema = z.object({
  importId: z.string().min(1),
  storagePath: z.string().min(1),
  baseName: z.string().min(1),
  fieldMapping: z.record(z.string(), z.string()),
  sourceFormat: z.string().min(1),
  totalRows: z.number().int().positive(),
})

export async function POST(request: NextRequest) {
  try {
    const radarAccess = await getRadarAccess(request)
    if (radarAccess.error) {
      return NextResponse.json(radarAccess.error, { status: radarAccess.status })
    }

    const body = await request.json().catch(() => null)
    const parsed = MappedRadarImportSchema.safeParse(body)
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Payload inválido"
      return NextResponse.json(new Output(false, [], [message], null), { status: 400 })
    }

    const output = await radarBaseImportUseCase.enqueueMappedImport({
      ...parsed.data,
      ctx: radarAccess.access,
    })

    return NextResponse.json(output, { status: output.isValid ? 202 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[RadarImportMappedRoute][POST]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno ao enfileirar importação"], null), { status: 500 })
  }
}
