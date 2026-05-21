import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import {
  backofficeAllUsersUseCase,
  type BackofficeAllUsersPlanFilter,
  type BackofficeAllUsersRoleFilter,
} from "@/app/api/useCases/backoffice/BackofficeAllUsersUseCase"

const ROLE_VALUES = ["master", "manager", "operator"] as const
const PLAN_VALUES = ["lifetime", "monthly", "trial", "none"] as const

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function parseRole(value: string | null): BackofficeAllUsersRoleFilter | undefined {
  if (!value) return undefined
  return (ROLE_VALUES as readonly string[]).includes(value)
    ? (value as BackofficeAllUsersRoleFilter)
    : undefined
}

function parsePlan(value: string | null): BackofficeAllUsersPlanFilter | undefined {
  if (!value) return undefined
  return (PLAN_VALUES as readonly string[]).includes(value)
    ? (value as BackofficeAllUsersPlanFilter)
    : undefined
}

export async function GET(request: NextRequest) {
  try {
    const accessResult = await getBackofficeAccess(request)
    if (accessResult.error) {
      return NextResponse.json(accessResult.error, { status: accessResult.status })
    }

    const { searchParams } = new URL(request.url)
    const query = searchParams.get("q")?.trim() ?? undefined
    const role = parseRole(searchParams.get("role"))
    const plan = parsePlan(searchParams.get("plan"))
    const page = parsePositiveInt(searchParams.get("page"), 1)
    const pageSize = Math.min(Math.max(parsePositiveInt(searchParams.get("pageSize"), 10), 5), 100)

    const output = await backofficeAllUsersUseCase.list({
      filters: { query, role, plan },
      page,
      pageSize,
    })

    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    console.error("[BackofficeAllUsersRoute][GET]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
