import { NextResponse, type NextRequest, connection } from "next/server";
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { requireManagerAccess } from "@/app/api/v1/backoffice/utils/requireManagerAccess"
import { backofficeMemberUseCase } from "@/app/api/useCases/backoffice/BackofficeMemberUseCase"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  await connection();

  try {
    const accessResult = await getBackofficeAccess(request)
    if (accessResult.error) {
      return NextResponse.json(accessResult.error, { status: accessResult.status })
    }
    const denied = requireManagerAccess(accessResult.access)
    if (denied) return denied

    const accountMasterId = request.nextUrl.searchParams.get("accountMasterId")
    if (!accountMasterId) {
      return NextResponse.json(
        new Output(false, [], ["accountMasterId é obrigatório"], null),
        { status: 400 }
      )
    }

    const { memberId } = await params
    const output = await backofficeMemberUseCase.listAccountTeamMemberships(
      memberId,
      accountMasterId
    )

    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeMemberAccountTeamsRoute][GET]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
