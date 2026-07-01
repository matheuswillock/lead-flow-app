import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { requireMasterAccess } from "@/app/api/v1/backoffice/utils/requireMasterAccess"
import { backofficeWhatsAppInstanceUseCase } from "@/app/api/useCases/backofficeWhatsApp/BackofficeWhatsAppInstanceUseCase"
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';

type RouteContext = { params: Promise<{ configId: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const access = await getBackofficeAccess(request)
    if (access.error) return NextResponse.json(access.error, { status: access.status })
    const denied = requireMasterAccess(access.access)
    if (denied) return denied

    const { configId } = await context.params
    const output = await backofficeWhatsAppInstanceUseCase.syncHistory(
      configId,
      access.access.profileId
    )
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[BackofficeWhatsAppInstanceSyncHistoryRoute][POST]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
