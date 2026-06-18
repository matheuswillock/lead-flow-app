import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { requireMasterAccess } from "@/app/api/v1/backoffice/utils/requireMasterAccess"
import {
  backofficeLeadScheduleUseCase,
} from "@/app/api/useCases/backofficeLeadSchedule/BackofficeLeadScheduleUseCase"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const accessResult = await getBackofficeAccess(request)
    if (accessResult.error) {
      return NextResponse.json(accessResult.error, { status: accessResult.status })
    }
    const denied = requireMasterAccess(accessResult.access)
    if (denied) return denied

    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const output = await backofficeLeadScheduleUseCase.cancelSchedule({
      leadId: id,
      canceledByProfileId: accessResult.access.profileId,
      reason: body?.reason,
    })

    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    console.error("[BackofficeLeadScheduleCancelRoute][POST]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
