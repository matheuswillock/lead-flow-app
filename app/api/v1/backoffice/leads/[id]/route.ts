import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { backofficeLeadUseCase } from "@/app/api/useCases/backofficeLead/BackofficeLeadUseCase"

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
    const output = await backofficeLeadUseCase.getLeadById(id)
    return NextResponse.json(output, { status: output.isValid ? 200 : 404 })
  } catch (error) {
    console.error("[BackofficeLeadByIdRoute][GET]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
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
    if (!body || typeof body !== "object") {
      return NextResponse.json(new Output(false, [], ["Payload inválido"], null), { status: 400 })
    }

    const data = body as Record<string, unknown>
    const output = await backofficeLeadUseCase.updateLead(id, {
      name: typeof data.name === "string" ? data.name : undefined,
      email: typeof data.email === "string" || data.email === null ? data.email : undefined,
      phone: typeof data.phone === "string" || data.phone === null ? data.phone : undefined,
      notes: typeof data.notes === "string" || data.notes === null ? data.notes : undefined,
      sdrBackofficeUserId:
        typeof data.sdrBackofficeUserId === "string" || data.sdrBackofficeUserId === null
          ? data.sdrBackofficeUserId
          : undefined,
      closerBackofficeUserId:
        typeof data.closerBackofficeUserId === "string" ||
        data.closerBackofficeUserId === null
          ? data.closerBackofficeUserId
          : undefined,
      meetingDate:
        typeof data.meetingDate === "string" || data.meetingDate === null
          ? data.meetingDate
          : undefined,
      meetingTitle:
        typeof data.meetingTitle === "string" || data.meetingTitle === null
          ? data.meetingTitle
          : undefined,
      meetingNotes:
        typeof data.meetingNotes === "string" || data.meetingNotes === null
          ? data.meetingNotes
          : undefined,
      meetingLink:
        typeof data.meetingLink === "string" || data.meetingLink === null
          ? data.meetingLink
          : undefined,
    })
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    console.error("[BackofficeLeadByIdRoute][PUT]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const result = await getBackofficeAccess(request)
    if (result.error) {
      return NextResponse.json(result.error, { status: result.status })
    }

    const { id } = await params
    const output = await backofficeLeadUseCase.deleteLead(id)
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    console.error("[BackofficeLeadByIdRoute][DELETE]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
