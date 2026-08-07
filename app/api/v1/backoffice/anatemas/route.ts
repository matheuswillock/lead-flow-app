import { NextResponse, type NextRequest, connection } from "next/server";
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { requireManagerAccess } from "@/app/api/v1/backoffice/utils/requireManagerAccess"
import { backofficeAnathemasUseCase } from "@/app/api/useCases/backoffice/BackofficeAnathemasUseCase"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"

export async function GET(request: NextRequest) {
  await connection();

  try {
    const accessResult = await getBackofficeAccess(request)
    if (accessResult.error) {
      return NextResponse.json(accessResult.error, { status: accessResult.status })
    }

    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get("page") ?? "1", 10)
    const pageSize = parseInt(url.searchParams.get("pageSize") ?? "20", 10)
    const statusParam = url.searchParams.get("status")
    const status =
      statusParam === "ACTIVE" || statusParam === "LIFTED" || statusParam === "all"
        ? statusParam
        : "all"
    const query = url.searchParams.get("q") ?? undefined

    const output = await backofficeAnathemasUseCase.list({ page, pageSize, status, query })
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeAnatemasRoute][GET]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const accessResult = await getBackofficeAccess(request)
    if (accessResult.error) {
      return NextResponse.json(accessResult.error, { status: accessResult.status })
    }

    const denied = requireManagerAccess(accessResult.access)
    if (denied) return denied

    const body = (await request.json()) as { profileId?: string; reason?: string | null }
    if (!body.profileId) {
      return NextResponse.json(
        new Output(false, [], ["profileId é obrigatório"], null),
        { status: 400 }
      )
    }

    const output = await backofficeAnathemasUseCase.banUser(
      body.profileId,
      body.reason,
      accessResult.access
    )

    return NextResponse.json(output, { status: output.isValid ? 201 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeAnatemasRoute][POST]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
