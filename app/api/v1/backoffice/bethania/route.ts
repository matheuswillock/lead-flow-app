import { NextResponse, type NextRequest } from "next/server"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { backofficeBethaniaUseCase } from "@/app/api/useCases/backofficeBethania/BackofficeBethaniaUseCase"

export async function GET(request: NextRequest) {
  const access = await getBackofficeAccess(request)
  if (access.error) return NextResponse.json(access.error, { status: access.status })
  try {
    const output = await backofficeBethaniaUseCase.execute({ operation: "overview" })
    if (!output.isValid) return NextResponse.json({ error: "Erro interno" }, { status: output.result?.status ?? 500 })
    return NextResponse.json(output.result)
  } catch (error) {
    console.error("[BackofficeBethaniaRoute][GET]", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
