import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { invalidateBackofficeFeaturesCache } from "@/lib/cache/invalidation"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { requireMasterAccess } from "@/app/api/v1/backoffice/utils/requireMasterAccess"
import { backofficeFeatureUseCase } from "@/app/api/useCases/backofficeFeature/BackofficeFeatureUseCase"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const result = await getBackofficeAccess(request)
    if (result.error) {
      return NextResponse.json(result.error, { status: result.status })
    }

    const { id } = await params
    const output = await backofficeFeatureUseCase.listBetaUsers(id)
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    console.error("[BackofficeFeatureBetaUsersRoute][GET]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const result = await getBackofficeAccess(request)
    if (result.error) {
      return NextResponse.json(result.error, { status: result.status })
    }
    const denied = requireMasterAccess(result.access)
    if (denied) return denied

    const { id } = await params
    const body = (await request.json()) as { profileId?: string }
    if (!body.profileId) {
      return NextResponse.json(new Output(false, [], ["profileId é obrigatório"], null), {
        status: 400,
      })
    }

    const output = await backofficeFeatureUseCase.addBetaUser(id, body.profileId)
    if (output.isValid) {
      invalidateBackofficeFeaturesCache()
    }
    return NextResponse.json(output, { status: output.isValid ? 201 : 400 })
  } catch (error) {
    console.error("[BackofficeFeatureBetaUsersRoute][POST]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
