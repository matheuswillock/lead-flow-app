import { NextResponse, type NextRequest, connection } from "next/server";
import { getRadarAccess, teamContextFromRadarAccess } from "@/app/api/v1/radar/utils/getRadarAccess"
import { customerDataPlatformUseCase } from "@/app/api/useCases/radar/RadarUseCase"
import { updateRadarProfileUseCase } from "@/app/api/useCases/radar/UpdateRadarProfileUseCase"
import { patchRadarProfileSchema } from "@/app/api/v1/radar/profiles/[id]/patchRadarProfileSchema"
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: RouteParams) {
  await connection();

  try {
    const radarAccess = await getRadarAccess(request)
    if (radarAccess.error) {
      return NextResponse.json(radarAccess.error, { status: radarAccess.status })
    }

    const { id } = await params
    const result = await customerDataPlatformUseCase.getProfile(
      radarAccess.access.teamId,
      teamContextFromRadarAccess(radarAccess.access),
      id
    )

    return NextResponse.json(result, { status: result.isValid ? 200 : 404 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[RadarProfileByIdRoute][GET]", error)
    return NextResponse.json({ isValid: false, successMessages: [], errorMessages: ["Erro interno"], result: null }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  await connection()

  try {
    const radarAccess = await getRadarAccess(request)
    if (radarAccess.error) {
      return NextResponse.json(radarAccess.error, { status: radarAccess.status })
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { isValid: false, successMessages: [], errorMessages: ["Corpo da requisição inválido"], result: null },
        { status: 400 }
      )
    }

    const parsed = patchRadarProfileSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          isValid: false,
          successMessages: [],
          errorMessages: parsed.error.issues.map((issue) => issue.message),
          result: null,
        },
        { status: 400 }
      )
    }

    const { id } = await params
    const output = await updateRadarProfileUseCase.execute({
      profileId: id,
      access: radarAccess.access,
      ctx: teamContextFromRadarAccess(radarAccess.access),
      gender: parsed.data.gender,
    })

    if (!output.isValid) {
      const message = output.errorMessages.join(" ")
      const status = message.includes("não encontrado") ? 404 : 400
      return NextResponse.json(output, { status })
    }

    return NextResponse.json(output, { status: 200 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[RadarProfileByIdRoute][PATCH]", error)
    return NextResponse.json(
      { isValid: false, successMessages: [], errorMessages: ["Erro interno"], result: null },
      { status: 500 }
    )
  }
}
