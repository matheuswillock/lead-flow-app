import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { invalidateTeamMembersCache } from "@/lib/cache/invalidation"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { requireManagerAccess } from "@/app/api/v1/backoffice/utils/requireManagerAccess"
import { backofficePlatformUsersUseCase } from "@/app/api/useCases/backoffice/BackofficePlatformUsersUseCase"
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';

type RouteParams = { params: Promise<{ id: string; teamId: string }> }

function resolveStatus(output: Output) {
  const messages = output.errorMessages.join(" ")
  if (messages.includes("não encontrado")) return 404
  if (messages.includes("já pertence")) return 409
  return 400
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const access = await getBackofficeAccess(request)
    if (access.error) {
      return NextResponse.json(access.error, { status: access.status })
    }
    const denied = requireManagerAccess(access.access)
    if (denied) return denied

    const { id, teamId } = await params
    const output = await backofficePlatformUsersUseCase.addMasterUserToTeam(id, teamId)
    if (output.isValid) {
      invalidateTeamMembersCache({ teamId })
    }

    return NextResponse.json(output, { status: output.isValid ? 200 : resolveStatus(output) })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[BackofficePlatformUserTeamAddMasterRoute][POST]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
