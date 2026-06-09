import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { BackofficePlatformUsersUseCase } from "@/app/api/useCases/backoffice/BackofficePlatformUsersUseCase"
import { BackofficePlatformUsersRepository } from "@/app/api/infra/data/repositories/backoffice/PlatformUsersRepository/BackofficePlatformUsersRepository"

const VALID_ROLES = ["manager", "backoffice", "operator"] as const
const VALID_FUNCTIONS = ["SDR", "CLOSER"] as const

type MemberRole = (typeof VALID_ROLES)[number]
type MemberFunction = (typeof VALID_FUNCTIONS)[number]

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await getBackofficeAccess(request)
    if (access.error) {
      return NextResponse.json(access.error, { status: access.status })
    }

    const { id } = await params
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== "object") {
      return NextResponse.json(new Output(false, [], ["Payload inválido"], null), { status: 400 })
    }

    const data = body as Record<string, unknown>

    const fullName = typeof data.fullName === "string" ? data.fullName.trim() : ""
    const email = typeof data.email === "string" ? data.email.trim().toLowerCase() : ""
    const phone =
      typeof data.phone === "string" && data.phone.trim()
        ? data.phone.trim()
        : null
    const role: MemberRole =
      typeof data.role === "string" && (VALID_ROLES as readonly string[]).includes(data.role)
        ? (data.role as MemberRole)
        : "operator"
    const functions: MemberFunction[] = Array.isArray(data.functions)
      ? (data.functions as unknown[]).filter(
          (f): f is MemberFunction =>
            typeof f === "string" && (VALID_FUNCTIONS as readonly string[]).includes(f)
        )
      : []
    const teamId = typeof data.teamId === "string" ? data.teamId.trim() : ""
    const canCreateAccountUsers = data.canCreateAccountUsers === true
    const canManageAccountTeams = data.canManageAccountTeams === true

    if (!fullName) {
      return NextResponse.json(
        new Output(false, [], ["Nome completo é obrigatório"], null),
        { status: 400 }
      )
    }

    if (!email) {
      return NextResponse.json(
        new Output(false, [], ["E-mail é obrigatório"], null),
        { status: 400 }
      )
    }

    if (!teamId) {
      return NextResponse.json(
        new Output(false, [], ["Time é obrigatório"], null),
        { status: 400 }
      )
    }

    const useCase = new BackofficePlatformUsersUseCase(new BackofficePlatformUsersRepository())
    const output = await useCase.addMemberToMasterUser(id, {
      fullName,
      email,
      phone,
      role,
      functions,
      teamId,
      canCreateAccountUsers,
      canManageAccountTeams,
    })

    return NextResponse.json(output, { status: output.isValid ? 201 : 400 })
  } catch (error) {
    console.error("[BackofficePlatformUserMembersRoute][POST]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
