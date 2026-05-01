import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import {
  backofficeAdhesionUseCase,
  isBackofficeAdhesionStatusValue,
} from "@/app/api/useCases/backofficeAdhesion/BackofficeAdhesionUseCase"

const ADHESION_CYCLES = ["monthly", "quarterly", "semiannual"] as const
type BackofficeAdhesionBillingCycleValue = (typeof ADHESION_CYCLES)[number]

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function parseCycle(value: unknown): BackofficeAdhesionBillingCycleValue | null {
  return typeof value === "string" && (ADHESION_CYCLES as readonly string[]).includes(value)
    ? (value as BackofficeAdhesionBillingCycleValue)
    : null
}

function optionalString(data: Record<string, unknown>, key: string): string | null | undefined {
  const value = data[key]
  return typeof value === "string" || value === null ? value : undefined
}

function optionalInteger(data: Record<string, unknown>, key: string): number | undefined {
  const value = data[key]
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value)
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

export async function GET(request: NextRequest) {
  try {
    const access = await getBackofficeAccess(request)
    if (access.error) {
      return NextResponse.json(access.error, { status: access.status })
    }

    const { searchParams } = new URL(request.url)
    const page = parsePositiveInt(searchParams.get("page"), 1)
    const pageSize = Math.max(parsePositiveInt(searchParams.get("pageSize"), 10), 5)
    const rawStatus = searchParams.get("status")
    const status = isBackofficeAdhesionStatusValue(rawStatus)
      ? rawStatus
      : undefined
    const query = searchParams.get("q") ?? undefined

    const output = await backofficeAdhesionUseCase.list({ page, pageSize, status, query })
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    console.error("[BackofficeAdhesionsRoute][GET]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await getBackofficeAccess(request)
    if (access.error) {
      return NextResponse.json(access.error, { status: access.status })
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== "object") {
      return NextResponse.json(new Output(false, [], ["Payload inválido"], null), { status: 400 })
    }

    const data = body as Record<string, unknown>
    const cycle = parseCycle(data.cycle)
    if (!cycle) {
      return NextResponse.json(new Output(false, [], ["Ciclo inválido"], null), { status: 400 })
    }

    const output = await backofficeAdhesionUseCase.create(
      {
        leadId: typeof data.leadId === "string" ? data.leadId : "",
        fullName: typeof data.fullName === "string" ? data.fullName : "",
        phone: typeof data.phone === "string" ? data.phone : "",
        cycle,
        extraTeams: optionalInteger(data, "extraTeams") ?? 0,
        extraUsers: optionalInteger(data, "extraUsers") ?? 0,
        sdrBackofficeUserId: optionalString(data, "sdrBackofficeUserId"),
        closerBackofficeUserId: optionalString(data, "closerBackofficeUserId"),
      },
      access.access.backofficeUserId
    )
    return NextResponse.json(output, { status: output.isValid ? 201 : 400 })
  } catch (error) {
    console.error("[BackofficeAdhesionsRoute][POST]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
