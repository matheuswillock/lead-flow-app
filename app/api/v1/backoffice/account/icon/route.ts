import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import {
  backofficeAccountIconUseCase,
} from "@/app/api/useCases/backofficeAccountIcon/BackofficeAccountIconUseCase"

export async function POST(request: NextRequest) {
  try {
    const accessResult = await getBackofficeAccess(request)
    if (accessResult.error) {
      return NextResponse.json(accessResult.error, { status: accessResult.status })
    }

    const formData = await request.formData()
    const file = formData.get("icon")
    if (!(file instanceof File)) {
      return NextResponse.json(new Output(false, [], ["Arquivo não informado"], null), {
        status: 400,
      })
    }

    const output = await backofficeAccountIconUseCase.uploadIcon({
      profileId: accessResult.access.profileId,
      supabaseId: accessResult.access.supabaseId,
      file,
    })

    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    console.error("[BackofficeAccountIconRoute][POST]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const accessResult = await getBackofficeAccess(request)
    if (accessResult.error) {
      return NextResponse.json(accessResult.error, { status: accessResult.status })
    }

    const output = await backofficeAccountIconUseCase.removeIcon({
      profileId: accessResult.access.profileId,
      supabaseId: accessResult.access.supabaseId,
    })

    const status = output.isValid ? 200 : output.errorMessages.includes("Perfil não encontrado")
      ? 404
      : 400
    return NextResponse.json(output, { status })
  } catch (error) {
    console.error("[BackofficeAccountIconRoute][DELETE]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
