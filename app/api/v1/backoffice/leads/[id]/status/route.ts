import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import {
  backofficeLeadUseCase,
  BACKOFFICE_LEAD_STATUS_VALUES,
  type BackofficeLeadStatusValue,
} from "@/app/api/useCases/backofficeLead/BackofficeLeadUseCase"

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
    const status = body?.status

    if (
      typeof status !== "string" ||
      !(BACKOFFICE_LEAD_STATUS_VALUES as readonly string[]).includes(status)
    ) {
      return NextResponse.json(new Output(false, [], ["Status inválido"], null), { status: 400 })
    }

    const output = await backofficeLeadUseCase.updateLeadStatus(
      id,
      status as BackofficeLeadStatusValue
    )
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    console.error("[BackofficeLeadStatusRoute][PUT]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
