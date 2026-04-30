import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import {
  backofficeLeadUseCase,
  BACKOFFICE_LEAD_STATUS_VALUES,
  type BackofficeLeadStatusValue,
} from "@/app/api/useCases/backofficeLead/BackofficeLeadUseCase"

function optionalStringOrNull(data: Record<string, unknown> | null, key: string) {
  const value = data?.[key]
  return typeof value === "string" || value === null ? value : undefined
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const result = await getBackofficeAccess(request)
    if (result.error) {
      return NextResponse.json(result.error, { status: result.status })
    }

    const { id } = await params
    const body = await request.json().catch(() => null)
    const data = body && typeof body === "object" ? (body as Record<string, unknown>) : null
    const status = data?.status

    if (
      typeof status !== "string" ||
      !(BACKOFFICE_LEAD_STATUS_VALUES as readonly string[]).includes(status)
    ) {
      return NextResponse.json(new Output(false, [], ["Status inválido"], null), { status: 400 })
    }

    const output = await backofficeLeadUseCase.updateLeadStatus(
      id,
      status as BackofficeLeadStatusValue,
      {
        closerBackofficeUserId: optionalStringOrNull(data, "closerBackofficeUserId"),
        meetingDate: optionalStringOrNull(data, "meetingDate"),
        meetingTitle: optionalStringOrNull(data, "meetingTitle"),
        meetingNotes: optionalStringOrNull(data, "meetingNotes"),
        meetingLink: optionalStringOrNull(data, "meetingLink"),
      }
    )
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    console.error("[BackofficeLeadStatusRoute][PUT]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
