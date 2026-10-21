import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { requireManagerAccess } from "@/app/api/v1/backoffice/utils/requireManagerAccess"
import { getPaymentProviderRefundUseCase } from "@/app/api/useCases/paymentProviderPayment/paymentProviderPaymentComposition"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> },
) {
  try {
    const access = await getBackofficeAccess(request)
    if (access.error) return NextResponse.json(access.error, { status: access.status })
    const denied = requireManagerAccess(access.access)
    if (denied) return denied

    const { attemptId } = await params
    const body = (await request.json().catch(() => ({}))) as { reason?: string }
    const output = await (await getPaymentProviderRefundUseCase()).execute({
      attemptId,
      reason: typeof body.reason === "string" ? body.reason : undefined,
    })
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[PaymentProviderRefundRoute][POST] Error", {
      message: error instanceof Error ? error.message : "unknown",
    })
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
