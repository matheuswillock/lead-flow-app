import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { BackofficeEmailSettingsUseCase } from "@/app/api/useCases/backoffice/BackofficeEmailSettingsUseCase"

const useCase = new BackofficeEmailSettingsUseCase()

export async function GET(request: NextRequest) {
  try {
    const access = await getBackofficeAccess(request)
    if (access.error) {
      return NextResponse.json(access.error, { status: access.status })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search") ?? undefined
    const page = Math.max(1, Number(searchParams.get("page") ?? "1"))
    const pageSize = Math.min(50, Math.max(1, Number(searchParams.get("pageSize") ?? "20")))

    const output = await useCase.list({ search, page, pageSize })
    return NextResponse.json(output, { status: output.isValid ? 200 : 500 })
  } catch (error) {
    console.error("[BackofficeEmailSettingsRoute][GET]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
