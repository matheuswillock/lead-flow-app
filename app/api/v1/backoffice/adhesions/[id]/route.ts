import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { backofficeAdhesionUseCase } from "@/app/api/useCases/backofficeAdhesion/BackofficeAdhesionUseCase"

const ADHESION_CYCLES = ["monthly", "quarterly", "semiannual"] as const
type BackofficeAdhesionBillingCycleValue = (typeof ADHESION_CYCLES)[number]

function parseCycle(value: unknown): BackofficeAdhesionBillingCycleValue | undefined {
  return typeof value === "string" && (ADHESION_CYCLES as readonly string[]).includes(value)
    ? (value as BackofficeAdhesionBillingCycleValue)
    : undefined
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await getBackofficeAccess(request)
    if (access.error) {
      return NextResponse.json(access.error, { status: access.status })
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== "object") {
      return NextResponse.json(new Output(false, [], ["Payload inválido"], null), { status: 400 })
    }

    const { id } = await params
    const data = body as Record<string, unknown>
    const output = await backofficeAdhesionUseCase.update(id, {
      fullName: typeof data.fullName === "string" ? data.fullName : undefined,
      phone: typeof data.phone === "string" ? data.phone : undefined,
      cycle: parseCycle(data.cycle),
      extraTeams: optionalInteger(data, "extraTeams"),
      extraUsers: optionalInteger(data, "extraUsers"),
      sdrBackofficeUserId: optionalString(data, "sdrBackofficeUserId"),
      closerBackofficeUserId: optionalString(data, "closerBackofficeUserId"),
    })

    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    console.error("[BackofficeAdhesionByIdRoute][PATCH]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
