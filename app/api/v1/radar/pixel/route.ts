import { NextResponse, type NextRequest, connection } from "next/server";
import { z } from "zod"
import { Output } from "@/lib/output"
import { getRadarAccess } from "@/app/api/v1/radar/utils/getRadarAccess"
import { radarPixelUseCase } from "@/app/api/useCases/radar/RadarPixelUseCase"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"

const resolveAppUrl = (request: NextRequest): string => {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (configured) {
    return configured.endsWith("/") ? configured.slice(0, -1) : configured
  }
  const url = new URL(request.url)
  return `${url.protocol}//${url.host}`
}

const savePixelConfigSchema = z.object({
  allowedOrigins: z.array(z.string().url("Cada origem deve ser uma URL válida")).default([]),
})

export async function GET(request: NextRequest) {
  await connection();

  try {
    const radarAccess = await getRadarAccess(request)
    if (radarAccess.error) {
      return NextResponse.json(radarAccess.error, { status: radarAccess.status })
    }

    const result = await radarPixelUseCase.getConfig(radarAccess.access.teamId, resolveAppUrl(request))
    return NextResponse.json(result, { status: result.isValid ? 200 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[RadarPixelRoute][GET]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const radarAccess = await getRadarAccess(request)
    if (radarAccess.error) {
      return NextResponse.json(radarAccess.error, { status: radarAccess.status })
    }

    const body: unknown = await request.json()
    const parsed = savePixelConfigSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        new Output(false, [], parsed.error.issues.map((issue) => issue.message), null),
        { status: 400 },
      )
    }

    const result = await radarPixelUseCase.saveConfig(
      radarAccess.access.teamId,
      radarAccess.access.profileId,
      parsed.data,
      resolveAppUrl(request),
    )
    return NextResponse.json(result, { status: result.isValid ? 200 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[RadarPixelRoute][POST]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const radarAccess = await getRadarAccess(request)
    if (radarAccess.error) {
      return NextResponse.json(radarAccess.error, { status: radarAccess.status })
    }

    const result = await radarPixelUseCase.deleteConfig(radarAccess.access.teamId)
    return NextResponse.json(result, { status: result.isValid ? 200 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[RadarPixelRoute][DELETE]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
