import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { SendFormDomainDnsInstructionsUseCase } from "@/app/api/useCases/email/SendFormDomainDnsInstructionsUseCase"
import { isManagerLikeRole } from "@/lib/roles"
import {
  consumeDnsInstructionsSendRateLimit,
  DNS_INSTRUCTIONS_SEND_RATE_LIMIT_MESSAGE,
} from "@/lib/email/dns-instructions-rate-limit"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"

export async function POST(request: NextRequest) {
  try {
    const teamAccess = await getTeamAccess(request)
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status })
    }

    if (!isManagerLikeRole(teamAccess.access.teamMember.role)) {
      return NextResponse.json(
        new Output(false, [], ["Apenas managers podem enviar instruções de DNS"], null),
        { status: 403 },
      )
    }

    // Mesmo teto por time do domínio de envio: manager autenticado não pode
    // virar spam relay com o remetente da plataforma.
    const rateLimit = await consumeDnsInstructionsSendRateLimit(teamAccess.access.teamId)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        new Output(false, [], [DNS_INSTRUCTIONS_SEND_RATE_LIMIT_MESSAGE], null),
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
      )
    }

    const body = (await request.json().catch(() => null)) as {
      recipientEmail?: unknown
    } | null
    const recipientEmail = typeof body?.recipientEmail === "string" ? body.recipientEmail : ""

    const useCase = new SendFormDomainDnsInstructionsUseCase()
    const output = await useCase.execute(teamAccess.access, { recipientEmail })
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[EmailSettingsFormDomainSendDnsInstructionsRoute][POST]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
