import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { invalidateTeamMembersCache } from "@/lib/cache/invalidation"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { requireMasterAccess } from "@/app/api/v1/backoffice/utils/requireMasterAccess"
import { backofficeMemberUseCase } from "@/app/api/useCases/backoffice/BackofficeMemberUseCase"
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';

function resolvePostStatus(output: Output) {
  const messages = output.errorMessages.join(" ")
  if (messages.includes("não encontrado")) return 404
  if (messages.includes("já pertence")) return 409
  if (messages.includes("não pertence à conta")) return 400
  return 400
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string; teamId: string }> }
) {
  try {
    const accessResult = await getBackofficeAccess(request)
    if (accessResult.error) {
      return NextResponse.json(accessResult.error, { status: accessResult.status })
    }
    const denied = requireMasterAccess(accessResult.access)
    if (denied) return denied

    const { memberId, teamId } = await params
    const body = await request.json().catch(() => ({}))

    const VALID_ROLES = ["manager", "backoffice", "operator"] as const
    const VALID_FUNCTIONS = ["SDR", "CLOSER"] as const

    const rawRole = body.role
    const role =
      typeof rawRole === "string" && (VALID_ROLES as readonly string[]).includes(rawRole)
        ? (rawRole as (typeof VALID_ROLES)[number])
        : undefined

    const rawFunctions = body.functions
    const functions =
      Array.isArray(rawFunctions)
        ? rawFunctions.filter((f): f is (typeof VALID_FUNCTIONS)[number] =>
            (VALID_FUNCTIONS as readonly string[]).includes(f as string)
          )
        : undefined

    const explicitAccess =
      role !== undefined && functions !== undefined
        ? {
            role,
            functions,
            canCreateAccountUsers:
              typeof body.canCreateAccountUsers === "boolean" ? body.canCreateAccountUsers : false,
            canManageAccountTeams:
              typeof body.canManageAccountTeams === "boolean" ? body.canManageAccountTeams : false,
            canTransferAccountLeads:
              typeof body.canTransferAccountLeads === "boolean"
                ? body.canTransferAccountLeads
                : false,
            canViewAllTeams:
              typeof body.canViewAllTeams === "boolean" ? body.canViewAllTeams : false,
          }
        : undefined

    const output = await backofficeMemberUseCase.addToTeam(memberId, teamId, explicitAccess)
    if (output.isValid) {
      invalidateTeamMembersCache({ teamId })
    }

    return NextResponse.json(output, { status: output.isValid ? 200 : resolvePostStatus(output) })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[BackofficeMemberTeamRoute][POST]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string; teamId: string }> }
) {
  try {
    const accessResult = await getBackofficeAccess(request)
    if (accessResult.error) {
      return NextResponse.json(accessResult.error, { status: accessResult.status })
    }
    const denied = requireMasterAccess(accessResult.access)
    if (denied) return denied

    const { memberId, teamId } = await params
    const output = await backofficeMemberUseCase.removeFromTeam(memberId, teamId)

    let status = 200
    if (!output.isValid) {
      if (
        output.errorMessages.includes("Membro não pertence a este time") ||
        output.errorMessages.includes("Membro não encontrado")
      ) {
        status = 404
      } else {
        status = 400
      }
    }

    return NextResponse.json(output, { status })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[BackofficeMemberTeamRoute][DELETE]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
