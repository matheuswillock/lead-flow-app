import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { requireManagerAccess } from "@/app/api/v1/backoffice/utils/requireManagerAccess"
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';
import {
  backofficeLeadUseCase,
  BACKOFFICE_LEAD_STATUS_VALUES,
  type BackofficeLeadStatusValue,
} from "@/app/api/useCases/backofficeLead/BackofficeLeadUseCase"

function optionalStringOrNull(data: Record<string, unknown> | null, key: string) {
  const value = data?.[key]
  return typeof value === "string" || value === null ? value : undefined
}

function optionalStringArray(data: Record<string, unknown> | null, key: string): string[] | undefined {
  const value = data?.[key]
  if (value === undefined || value === null) return undefined
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : undefined
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
    const denied = requireManagerAccess(result.access)
    if (denied) return denied

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
        meetingType: optionalStringOrNull(data, "meetingType"),
        meetingExtraGuests:
          optionalStringArray(data, "meetingExtraGuests") ?? optionalStringArray(data, "extraGuests"),
      }
    )
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[BackofficeLeadStatusRoute][PUT]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
