import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { backofficeMemberUseCase } from "@/app/api/useCases/backoffice/BackofficeMemberUseCase"

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string; teamId: string }> }
) {
  try {
    const accessResult = await getBackofficeAccess(request)
    if (accessResult.error) {
      return NextResponse.json(accessResult.error, { status: accessResult.status })
    }

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
    console.error("[BackofficeMemberTeamRoute][DELETE]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
