import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { backofficePlatformUsersUseCase } from "@/app/api/useCases/backoffice/BackofficePlatformUsersUseCase"

type RouteParams = { params: Promise<{ id: string; teamId: string }> }

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const access = await getBackofficeAccess(request)
    if (access.error) {
      return NextResponse.json(access.error, { status: access.status })
    }

    const { id, teamId } = await params
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== "object") {
      return NextResponse.json(new Output(false, [], ["Payload inválido"], null), { status: 400 })
    }

    const name = typeof (body as Record<string, unknown>).name === "string"
      ? ((body as Record<string, unknown>).name as string).trim()
      : ""

    if (!name) {
      return NextResponse.json(
        new Output(false, [], ["Nome do time é obrigatório"], null),
        { status: 400 }
      )
    }

    const output = await backofficePlatformUsersUseCase.updateTeamForMasterUser(id, teamId, { name })
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

    const { id, teamId } = await params
    const output = await backofficePlatformUsersUseCase.deleteTeamFromMasterUser(id, teamId)
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    console.error("[BackofficePlatformUserTeamByIdRoute][DELETE]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
