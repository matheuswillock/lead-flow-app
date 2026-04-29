import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import {
  backofficeLeadUseCase,
  type BackofficeLeadStatusValue,
} from "@/app/api/useCases/backofficeLead/BackofficeLeadUseCase"
import { BACKOFFICE_LEAD_STATUS_VALUES } from "@/app/api/useCases/backofficeLead/BackofficeLeadUseCase"

function parseStatus(value: string | null): BackofficeLeadStatusValue | undefined {
  if (!value) return undefined
  if ((BACKOFFICE_LEAD_STATUS_VALUES as readonly string[]).includes(value)) {
    return value as BackofficeLeadStatusValue
  }
  return undefined
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

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== "object") {
      return NextResponse.json(new Output(false, [], ["Payload inválido"], null), { status: 400 })
    }

    const output = await backofficeLeadUseCase.createLead(body, result.access.profileId)
    return NextResponse.json(output, { status: output.isValid ? 201 : 400 })
  } catch (error) {
    console.error("[BackofficeLeadsRoute][POST]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
