import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { backofficeAccountUseCase } from "@/app/api/useCases/backofficeAccount/BackofficeAccountUseCase"

export async function PATCH(request: NextRequest) {
  try {
    const accessResult = await getBackofficeAccess(request)
    if (accessResult.error) {
      return NextResponse.json(accessResult.error, { status: accessResult.status })
    }

    const body = await request.json().catch(() => ({}))
    const output = await backofficeAccountUseCase.updatePassword(
      accessResult.access.supabaseId,
      body?.password
    )
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    console.error("[BackofficeAccountPasswordRoute][PATCH]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
