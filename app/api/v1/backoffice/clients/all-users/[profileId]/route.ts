import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { backofficeAllUsersUseCase } from "@/app/api/useCases/backoffice/BackofficeAllUsersUseCase"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ profileId: string }> }
) {
  try {
    const accessResult = await getBackofficeAccess(request)
    if (accessResult.error) {
      return NextResponse.json(accessResult.error, { status: accessResult.status })
    }

    const { profileId } = await params
    const output = await backofficeAllUsersUseCase.getDetail(profileId)

    return NextResponse.json(output, {
      status: output.isValid ? 200 : output.errorMessages.includes("Usuário não encontrado") ? 404 : 400,
    })
  } catch (error) {
    console.error("[BackofficeAllUsersByIdRoute][GET]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
