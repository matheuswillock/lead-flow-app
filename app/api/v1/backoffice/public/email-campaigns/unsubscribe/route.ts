import { NextResponse, type NextRequest } from "next/server"
import { backofficeEmailCampaignUnsubscribeUseCase } from "@/app/api/useCases/backofficeEmailCampaign/BackofficeEmailCampaignUnsubscribeUseCase"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"
import { getClientIpFromRequest } from "@/lib/http/get-client-ip"
import {
  checkAndRegisterBackofficeUnsubscribeRateLimit,
  BACKOFFICE_UNSUBSCRIBE_RATE_LIMIT_MESSAGE,
} from "@/lib/email/backoffice-unsubscribe-rate-limit"

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIpFromRequest(request)
    const rateLimit = checkAndRegisterBackofficeUnsubscribeRateLimit(ip)
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: BACKOFFICE_UNSUBSCRIBE_RATE_LIMIT_MESSAGE }, { status: 429 })
    }

    const body = (await request.json().catch(() => ({}))) as { token?: string }
    const token = body.token ?? request.nextUrl.searchParams.get("token")
    if (!token) {
      return NextResponse.json({ error: "Token obrigatório" }, { status: 400 })
    }

    const output = await backofficeEmailCampaignUnsubscribeUseCase.unsubscribe(token)
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficePublicEmailCampaignUnsubscribeRoute][POST]", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
