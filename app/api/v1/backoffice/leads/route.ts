import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { requireMasterAccess } from "@/app/api/v1/backoffice/utils/requireMasterAccess"
import {
  backofficeLeadUseCase,
  type BackofficeLeadStatusValue,
} from "@/app/api/useCases/backofficeLead/BackofficeLeadUseCase"
import { BACKOFFICE_LEAD_STATUS_VALUES } from "@/app/api/useCases/backofficeLead/BackofficeLeadUseCase"
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';

function parseStatus(value: string | null): BackofficeLeadStatusValue | undefined {
  if (!value) return undefined
  if ((BACKOFFICE_LEAD_STATUS_VALUES as readonly string[]).includes(value)) {
    return value as BackofficeLeadStatusValue
  }
  return undefined
}

function optionalStringArray(data: Record<string, unknown>, key: string): string[] | undefined {
  const value = data[key]
  if (value === undefined || value === null) return undefined
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : undefined
}

export async function GET(request: NextRequest) {
  try {
    const result = await getBackofficeAccess(request)
    if (result.error) {
      return NextResponse.json(result.error, { status: result.status })
    }

    const { searchParams } = new URL(request.url)
    const status = parseStatus(searchParams.get("status"))

    const output = await backofficeLeadUseCase.listLeads({ status })
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[BackofficeLeadsRoute][GET]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const result = await getBackofficeAccess(request)
    if (result.error) {
      return NextResponse.json(result.error, { status: result.status })
    }
    const denied = requireMasterAccess(result.access)
    if (denied) return denied

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== "object") {
      return NextResponse.json(new Output(false, [], ["Payload inválido"], null), { status: 400 })
    }

    const data = body as Record<string, unknown>
    const output = await backofficeLeadUseCase.createLead(
      {
        name: typeof data.name === "string" ? data.name : "",
        email: typeof data.email === "string" || data.email === null ? data.email : null,
        phone: typeof data.phone === "string" || data.phone === null ? data.phone : null,
        cpfCnpj:
          typeof data.cpfCnpj === "string" || data.cpfCnpj === null
            ? data.cpfCnpj
            : typeof data.cnpj === "string" || data.cnpj === null
              ? data.cnpj
              : null,
        notes: typeof data.notes === "string" || data.notes === null ? data.notes : null,
        status:
          typeof data.status === "string"
            ? (data.status as BackofficeLeadStatusValue)
            : undefined,
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
        meetingExtraGuests: optionalStringArray(data, "meetingExtraGuests") ??
          optionalStringArray(data, "extraGuests"),
      },
      result.access.profileId
    )
    return NextResponse.json(output, { status: output.isValid ? 201 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[BackofficeLeadsRoute][POST]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
