import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { invalidateBackofficeFeaturesCache } from "@/lib/cache/invalidation"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { requireMasterAccess } from "@/app/api/v1/backoffice/utils/requireMasterAccess"
import { backofficeFeatureUseCase } from "@/app/api/useCases/backofficeFeature/BackofficeFeatureUseCase"

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; profileId: string }> }
) {
  try {
    const result = await getBackofficeAccess(request)
    if (result.error) {
      return NextResponse.json(result.error, { status: result.status })
    }
    const denied = requireMasterAccess(result.access)
    if (denied) return denied

    const { id, profileId } = await params
    const output = await backofficeFeatureUseCase.removeBetaUser(id, profileId)
    if (output.isValid) {
      invalidateBackofficeFeaturesCache()
    }
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    console.error("[BackofficeFeatureBetaUserByIdRoute][DELETE]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
