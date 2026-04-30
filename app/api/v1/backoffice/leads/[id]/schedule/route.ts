import { BackofficeLeadStatus } from "@prisma/client"
import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { backofficeLeadUseCase } from "@/app/api/useCases/backofficeLead/BackofficeLeadUseCase"
import { backofficeLeadScheduleService } from "@/app/api/services/backofficeLeadSchedule/BackofficeLeadScheduleService"

function stringArray(value: unknown): string[] | undefined {
  if (value === undefined) return undefined
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === "string")
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const accessResult = await getBackofficeAccess(request)
    if (accessResult.error) {
      return NextResponse.json(accessResult.error, { status: accessResult.status })
    }

    const { id } = await params
    const output = await backofficeLeadScheduleService.listSchedules(id)
    return NextResponse.json(output, { status: output.isValid ? 200 : 404 })
  } catch (error) {
    console.error("[BackofficeLeadScheduleRoute][GET]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}

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
    const output = await backofficeLeadUseCase.updateLeadStatus(
      id,
      BackofficeLeadStatus.scheduled,
      {
        closerBackofficeUserId: body?.closerBackofficeUserId ?? null,
        meetingDate: body?.meetingDate ?? null,
        meetingTitle: body?.meetingTitle ?? null,
        meetingNotes: body?.meetingNotes ?? null,
        meetingLink: body?.meetingLink ?? null,
        meetingExtraGuests: stringArray(body?.meetingExtraGuests) ?? stringArray(body?.extraGuests),
      }
    )

    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    console.error("[BackofficeLeadScheduleRoute][POST]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
