import { NextResponse, type NextRequest } from "next/server"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { backofficeBethaniaUseCase } from "@/app/api/useCases/backofficeBethania/BackofficeBethaniaUseCase"

export async function GET(request: NextRequest) {
  const access = await getBackofficeAccess(request)
  if (access.error) return NextResponse.json(access.error, { status: access.status })
  const params = request.nextUrl.searchParams
  const page = parsePositiveInteger(params.get("page"), 1)
  const pageSize = parsePositiveInteger(params.get("pageSize"), 25)
  try {
    const output = await backofficeBethaniaUseCase.execute({
      operation: "list-logs",
      eventType: params.get("eventType"),
      status: params.get("status"),
      page,
      pageSize: Math.min(pageSize, 100),
    })
    if (!output.isValid) return NextResponse.json({ error: "Erro interno" }, { status: output.result?.status ?? 500 })
    return NextResponse.json(output.result)
  } catch (error) {
    console.error("[BackofficeBethaniaLogsRoute][GET]", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}

function parsePositiveInteger(value: string | null, fallback: number): number {
  if (!value || !/^\d+$/.test(value)) return fallback
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback
}
