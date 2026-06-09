import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import {
  backofficeAdhesionUseCase,
  isBackofficeAdhesionStatusValue,
} from "@/app/api/useCases/backofficeAdhesion/BackofficeAdhesionUseCase"
type ParsedAdditionalUser = {
  name: string
  email: string
  role: "manager" | "backoffice" | "operator"
  functions: ("SDR" | "CLOSER")[]
}

type ParsedAdditionalTeam = {
  name: string
}

const ADHESION_CYCLES = ["monthly", "quarterly", "semiannual", "annual"] as const
const ACTIVATION_MODES = ["checkout", "external_paid"] as const
type BackofficeAdhesionBillingCycleValue = (typeof ADHESION_CYCLES)[number]
type BackofficeAdhesionActivationMode = (typeof ACTIVATION_MODES)[number]

const BILLING_TYPES = ["PIX", "CREDIT_CARD"] as const
type BackofficeAdhesionBillingTypeValue = (typeof BILLING_TYPES)[number]

const USER_TYPES = ["common", "member_pro"] as const
type BackofficeAdhesionUserTypeValue = (typeof USER_TYPES)[number]

function parseUserType(value: unknown): BackofficeAdhesionUserTypeValue | undefined {
  return typeof value === "string" && (USER_TYPES as readonly string[]).includes(value)
    ? (value as BackofficeAdhesionUserTypeValue)
    : undefined
}

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function parseCycle(value: unknown): BackofficeAdhesionBillingCycleValue | null {
  return typeof value === "string" && (ADHESION_CYCLES as readonly string[]).includes(value)
    ? (value as BackofficeAdhesionBillingCycleValue)
    : null
}

function parseActivationMode(value: unknown): BackofficeAdhesionActivationMode {
  return typeof value === "string" && (ACTIVATION_MODES as readonly string[]).includes(value)
    ? (value as BackofficeAdhesionActivationMode)
    : "checkout"
}

function parseBillingType(value: unknown): BackofficeAdhesionBillingTypeValue | null {
  return typeof value === "string" && (BILLING_TYPES as readonly string[]).includes(value)
    ? (value as BackofficeAdhesionBillingTypeValue)
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

const VALID_ROLES = ["manager", "backoffice", "operator"] as const
const VALID_FUNCTIONS = ["SDR", "CLOSER"] as const

function parseAdditionalUsers(data: Record<string, unknown>): BackofficeAdhesionAdditionalUser[] {
  const raw = data.additionalUsers
  if (!Array.isArray(raw)) return []
  return raw.flatMap((item: unknown) => {
    if (!item || typeof item !== "object") return []
    const u = item as Record<string, unknown>
    const name = typeof u.name === "string" ? u.name.trim() : ""
    const email = typeof u.email === "string" ? u.email.trim().toLowerCase() : ""
    const role = typeof u.role === "string" && (VALID_ROLES as readonly string[]).includes(u.role)
      ? (u.role as BackofficeAdhesionAdditionalUser["role"])
      : "operator"
    const functions = Array.isArray(u.functions)
      ? (u.functions as unknown[]).filter(
          (f): f is "SDR" | "CLOSER" =>
            typeof f === "string" && (VALID_FUNCTIONS as readonly string[]).includes(f)
        )
      : []
    if (!name || !email) return []
    return [{ name, email, role, functions }]
  })
}

function parseAdditionalTeams(data: Record<string, unknown>): BackofficeAdhesionAdditionalTeam[] {
  const raw = data.additionalTeams
  if (!Array.isArray(raw)) return []
  return raw.flatMap((item: unknown) => {
    if (!item || typeof item !== "object") return []
    const t = item as Record<string, unknown>
    const name = typeof t.name === "string" ? t.name.trim() : ""
    if (!name) return []
    return [{ name }]
  })
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
        email: optionalString(data, "email"),
        cpfCnpj: optionalString(data, "cpfCnpj"),
        cycle,
        extraTeams: optionalInteger(data, "extraTeams") ?? 0,
        extraUsers: optionalInteger(data, "extraUsers") ?? 0,
        billingType: parseBillingType(data.billingType),
        sdrBackofficeUserId: optionalString(data, "sdrBackofficeUserId"),
        closerBackofficeUserId: optionalString(data, "closerBackofficeUserId"),
        activationMode: parseActivationMode(data.activationMode),
        userType: parseUserType(data.userType),
        accessExpiresAt: optionalString(data, "accessExpiresAt"),
        additionalUsers: parseAdditionalUsers(data),
        additionalTeams: parseAdditionalTeams(data),
      },
      access.access.backofficeUserId
    )
    return NextResponse.json(output, { status: output.isValid ? 201 : 400 })
  } catch (error) {
    console.error("[BackofficeAdhesionsRoute][POST]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
