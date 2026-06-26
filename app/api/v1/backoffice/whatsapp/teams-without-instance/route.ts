import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { backofficeWhatsAppInstanceUseCase } from "@/app/api/useCases/backofficeWhatsApp/BackofficeWhatsAppInstanceUseCase"

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback
  }
  return parsed
}

export async function GET(request: NextRequest) {
  try {
    const access = await getBackofficeAccess(request)
    if (access.error) return NextResponse.json(access.error, { status: access.status })

    const { searchParams } = new URL(request.url)
    const q = searchParams.get("q") ?? undefined
    const page = parsePositiveInt(searchParams.get("page"), 1)
    const pageSize = parsePositiveInt(searchParams.get("pageSize"), 20)

    const output = await backofficeWhatsAppInstanceUseCase.listTeamsWithoutInstance(
      { q },
      { page, pageSize }
    )
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    console.error("[BackofficeWhatsAppTeamsWithoutInstanceRoute][GET]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
