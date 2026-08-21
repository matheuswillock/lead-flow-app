import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { requireManagerAccess } from "@/app/api/v1/backoffice/utils/requireManagerAccess"
import { backofficeAdhesionUseCase } from "@/app/api/useCases/backofficeAdhesion/BackofficeAdhesionUseCase"
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const headerId = request.headers.get("x-supabase-user-id")
    console.info("[BackofficeAdhesionInviteRoute][POST] hit", { headerId: headerId?.slice(0, 8) })
    const access = await getBackofficeAccess(request)
    if (access.error) {
      console.info("[BackofficeAdhesionInviteRoute][POST] access denied", { status: access.status, error: access.error.errorMessages })
      return NextResponse.json(access.error, { status: access.status })
    }
    const denied = requireManagerAccess(access.access)
    if (denied) return denied

    const { id } = await params
    console.info("[BackofficeAdhesionInviteRoute][POST] calling resendInvite", { id, supabaseId: access.access.supabaseId.slice(0, 8) })
    const output = await backofficeAdhesionUseCase.resendInvite(id)
    console.info("[BackofficeAdhesionInviteRoute][POST] resendInvite result", { id, isValid: output.isValid, errors: output.errorMessages })
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[BackofficeAdhesionInviteRoute][POST]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
