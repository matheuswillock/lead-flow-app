import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { requireMasterAccess } from "@/app/api/v1/backoffice/utils/requireMasterAccess"
import {
  backofficeLeadScheduleUseCase,
} from "@/app/api/useCases/backofficeLeadSchedule/BackofficeLeadScheduleUseCase"

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
    const output = await backofficeLeadScheduleUseCase.listSchedules(id)
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
    const denied = requireMasterAccess(accessResult.access)
    if (denied) return denied

    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const output = await backofficeLeadScheduleUseCase.scheduleLead({ leadId: id, payload: body })

    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    console.error("[BackofficeLeadScheduleRoute][POST]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
