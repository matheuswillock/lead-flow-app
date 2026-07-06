import { NextResponse, type NextRequest } from "next/server"
import { EmailUnsubscribeUseCase } from "@/app/api/useCases/email/EmailUnsubscribeUseCase"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"
import { getClientIpFromRequest } from "@/lib/http/get-client-ip"
import {
  checkAndRegisterUnsubscribeRateLimit,
  UNSUBSCRIBE_RATE_LIMIT_MESSAGE,
} from "@/lib/email/unsubscribe-rate-limit"

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIpFromRequest(request)
    const rateLimit = checkAndRegisterUnsubscribeRateLimit(ip)
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: UNSUBSCRIBE_RATE_LIMIT_MESSAGE }, { status: 429 })
    }

    const body = (await request.json().catch(() => ({}))) as { token?: string }
    const token = body.token ?? request.nextUrl.searchParams.get("token")
    if (!token) {
      return NextResponse.json({ error: "Token obrigatório" }, { status: 400 })
    }

    const useCase = new EmailUnsubscribeUseCase()
    const output = await useCase.unsubscribe(token)
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[EmailPublicUnsubscribeRoute][POST]", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
