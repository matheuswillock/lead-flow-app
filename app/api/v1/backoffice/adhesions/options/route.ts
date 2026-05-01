import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { backofficeAdhesionUseCase } from "@/app/api/useCases/backofficeAdhesion/BackofficeAdhesionUseCase"

export async function GET(request: NextRequest) {
  try {
    const access = await getBackofficeAccess(request)
    if (access.error) {
      return NextResponse.json(access.error, { status: access.status })
    }

    const output = await backofficeAdhesionUseCase.getOptions()
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    console.error("[BackofficeAdhesionOptionsRoute][GET]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
