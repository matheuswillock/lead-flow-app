import { NextResponse, type NextRequest, connection } from "next/server";
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { requireManagerAccess } from "@/app/api/v1/backoffice/utils/requireManagerAccess"
import { backofficeDeletionRequestUseCase } from "@/app/api/useCases/backofficeDeletion/BackofficeDeletionRequestUseCase"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"

export async function GET(request: NextRequest) {
  await connection();

  try {
    const accessResult = await getBackofficeAccess(request)
    if (accessResult.error) {
      return NextResponse.json(accessResult.error, { status: accessResult.status })
    }

    const status = request.nextUrl.searchParams.get("status") ?? undefined
    const output = await backofficeDeletionRequestUseCase.listRequests({ status })
    return NextResponse.json(output, { status: output.isValid ? 200 : 500 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeDeletionRequestsRoute][GET]", error)
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

    const body = await request.json().catch(() => ({}))
    const type = body.type as "USER_DELETE" | "TEAM_DELETE"
    const targetId = typeof body.targetId === "string" ? body.targetId : ""
    const reason = typeof body.reason === "string" ? body.reason : null

    if (!targetId || (type !== "USER_DELETE" && type !== "TEAM_DELETE")) {
      return NextResponse.json(
        new Output(false, [], ["type e targetId são obrigatórios"], null),
        { status: 400 }
      )
    }

    const output = await backofficeDeletionRequestUseCase.createRequest({
      type,
      targetId,
      reason,
      requestedByProfileId: accessResult.access.profileId,
    })

    return NextResponse.json(output, { status: output.isValid ? 201 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeDeletionRequestsRoute][POST]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
