import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { requireMasterAccess } from "@/app/api/v1/backoffice/utils/requireMasterAccess"
import { backofficePlatformUsersUseCase } from "@/app/api/useCases/backoffice/BackofficePlatformUsersUseCase"

type RouteParams = { params: Promise<{ id: string; teamId: string }> }

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const access = await getBackofficeAccess(request)
    if (access.error) {
      return NextResponse.json(access.error, { status: access.status })
    }
    const denied = requireMasterAccess(access.access)
    if (denied) return denied

    const { id, teamId } = await params
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== "object") {
      return NextResponse.json(new Output(false, [], ["Payload inválido"], null), { status: 400 })
    }

    const rawBody = body as Record<string, unknown>
    const name = typeof rawBody.name === "string" ? rawBody.name.trim() : undefined
    const transferTargetTeamIds = Array.isArray(rawBody.transferTargetTeamIds)
      ? (rawBody.transferTargetTeamIds as unknown[]).filter((v): v is string => typeof v === "string")
      : undefined

    if (name === undefined && transferTargetTeamIds === undefined) {
      return NextResponse.json(
        new Output(false, [], ["Nenhum campo para atualizar"], null),
        { status: 400 }
      )
    }

    if (name !== undefined && !name) {
      return NextResponse.json(
        new Output(false, [], ["Nome do time é obrigatório"], null),
        { status: 400 }
      )
    }

    const output = await backofficePlatformUsersUseCase.updateTeamForMasterUser(id, teamId, {
      ...(name ? { name } : {}),
      transferTargetTeamIds,
      updatedBy: access.access.profileId,
    })
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    console.error("[BackofficePlatformUserTeamByIdRoute][PATCH]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const access = await getBackofficeAccess(request)
    if (access.error) {
      return NextResponse.json(access.error, { status: access.status })
    }
    const denied = requireMasterAccess(access.access)
    if (denied) return denied

    const { id, teamId } = await params
    const output = await backofficePlatformUsersUseCase.deleteTeamFromMasterUser(id, teamId)
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    console.error("[BackofficePlatformUserTeamByIdRoute][DELETE]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
