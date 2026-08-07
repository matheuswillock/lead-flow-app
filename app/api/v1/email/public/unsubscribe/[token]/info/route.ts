import { NextResponse, type NextRequest, connection } from "next/server";
import { EmailUnsubscribeUseCase } from "@/app/api/useCases/email/EmailUnsubscribeUseCase"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"
import { getClientIpFromRequest } from "@/lib/http/get-client-ip"
import {
  checkAndRegisterUnsubscribeRateLimit,
  UNSUBSCRIBE_RATE_LIMIT_MESSAGE,
} from "@/lib/email/unsubscribe-rate-limit"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  await connection();

  try {
    const ip = getClientIpFromRequest(request)
    const rateLimit = checkAndRegisterUnsubscribeRateLimit(ip)
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: UNSUBSCRIBE_RATE_LIMIT_MESSAGE }, { status: 429 })
    }

    const { token } = await params
    const useCase = new EmailUnsubscribeUseCase()
    const output = await useCase.getInfo(token)
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[EmailPublicUnsubscribeInfoRoute][GET]", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
