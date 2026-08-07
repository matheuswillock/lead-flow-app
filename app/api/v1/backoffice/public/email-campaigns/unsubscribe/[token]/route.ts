import { NextResponse, type NextRequest, connection } from "next/server";
import { backofficeEmailCampaignUnsubscribeUseCase } from "@/app/api/useCases/backofficeEmailCampaign/BackofficeEmailCampaignUnsubscribeUseCase"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"
import { getClientIpFromRequest } from "@/lib/http/get-client-ip"
import {
  checkAndRegisterBackofficeUnsubscribeRateLimit,
  BACKOFFICE_UNSUBSCRIBE_RATE_LIMIT_MESSAGE,
} from "@/lib/email/backoffice-unsubscribe-rate-limit"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  await connection();

  try {
    const ip = getClientIpFromRequest(request)
    const rateLimit = checkAndRegisterBackofficeUnsubscribeRateLimit(ip)
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: BACKOFFICE_UNSUBSCRIBE_RATE_LIMIT_MESSAGE }, { status: 429 })
    }

    const { token } = await params
    const output = await backofficeEmailCampaignUnsubscribeUseCase.getInfo(token)
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficePublicEmailCampaignUnsubscribeInfoRoute][GET]", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
