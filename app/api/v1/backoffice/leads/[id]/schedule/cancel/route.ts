import { BackofficeLeadStatus } from "@prisma/client"
import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { backofficeLeadUseCase } from "@/app/api/useCases/backofficeLead/BackofficeLeadUseCase"
import { backofficeLeadScheduleService } from "@/app/api/services/backofficeLeadSchedule/BackofficeLeadScheduleService"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const accessResult = await getBackofficeAccess(request)
    if (accessResult.error) {
      return NextResponse.json(accessResult.error, { status: accessResult.status })
    }

    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const cancelOutput = await backofficeLeadScheduleService.cancelSchedule({
      leadId: id,
      canceledByProfileId: accessResult.access.profileId,
      reason: typeof body?.reason === "string" ? body.reason : null,
    })

    if (!cancelOutput.isValid) {
      return NextResponse.json(cancelOutput, { status: 400 })
    }

    const leadOutput = await backofficeLeadUseCase.updateLeadStatus(
      id,
      BackofficeLeadStatus.new_opportunity,
      {
        closerBackofficeUserId: null,
        meetingDate: null,
        meetingTitle: null,
        meetingNotes: null,
        meetingLink: null,
        meetingExtraGuests: [],
      }
    )

    if (!leadOutput.isValid) {
      return NextResponse.json(leadOutput, { status: 400 })
    }

    return NextResponse.json(
      new Output(true, cancelOutput.successMessages, [], {
        cancel: cancelOutput.result,
        lead: leadOutput.result,
      }),
      { status: 200 }
    )
  } catch (error) {
    console.error("[BackofficeLeadScheduleCancelRoute][POST]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
