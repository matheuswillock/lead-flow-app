import { NextResponse, type NextRequest, connection } from "next/server"
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { listBackofficeCronExecutionsUseCase } from "@/app/api/useCases/backofficeCronExecution/ListBackofficeCronExecutionsUseCase"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"

export async function GET(request: NextRequest) {
  await connection()

  try {
    const access = await getBackofficeAccess(request)
    if (access.error) return NextResponse.json(access.error, { status: access.status })

    const { searchParams } = new URL(request.url)
    const cronKey = searchParams.get("cronKey") ?? undefined
    const statusParam = searchParams.get("status")
    const status = statusParam && ["running", "success", "failed"].includes(statusParam)
      ? (statusParam as "running" | "success" | "failed")
      : undefined
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : undefined
    const startDate = searchParams.get("startDate")
      ? new Date(searchParams.get("startDate")!)
      : undefined
    const endDate = searchParams.get("endDate")
      ? new Date(searchParams.get("endDate")!)
      : undefined

    const output = await listBackofficeCronExecutionsUseCase.execute({
      cronKey,
      status,
      startDate,
      endDate,
      limit,
    })

    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeCronExecutionsRoute][GET]", error)
    return NextResponse.json(
      new Output(false, [], ["Erro interno"], null),
      { status: 500 }
    )
  }
}
