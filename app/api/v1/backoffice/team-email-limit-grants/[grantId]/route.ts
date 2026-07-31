import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { requireManagerAccess } from "@/app/api/v1/backoffice/utils/requireManagerAccess"
import { backofficeTeamEmailLimitGrantUseCase } from "@/app/api/useCases/backofficeTeamEmailLimitGrant/BackofficeTeamEmailLimitGrantUseCase"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"

type RouteParams = { params: Promise<{ grantId: string }> }

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const result = await getBackofficeAccess(request)
    if (result.error) {
      return NextResponse.json(result.error, { status: result.status })
    }
    const denied = requireManagerAccess(result.access)
    if (denied) return denied

    const { grantId } = await params
    const body = (await request.json()) as {
      maxEmailsPerDay?: number | null
      notes?: string | null
    }

    const output = await backofficeTeamEmailLimitGrantUseCase.update(
      grantId,
      result.access.profileId,
      body
    )
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeTeamEmailLimitGrantsRoute][PATCH]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const result = await getBackofficeAccess(request)
    if (result.error) {
      return NextResponse.json(result.error, { status: result.status })
    }
    const denied = requireManagerAccess(result.access)
    if (denied) return denied

    const { grantId } = await params
    const output = await backofficeTeamEmailLimitGrantUseCase.revoke(
      grantId,
      result.access.profileId
    )
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeTeamEmailLimitGrantsRoute][DELETE]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
