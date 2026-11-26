import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { createInviteLinkExchangeUseCase } from "@/app/api/useCases/auth/InviteLinkExchangeUseCase"
import { getTrustedClientIp } from "@/lib/http/get-trusted-client-ip"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"
import { Output } from "@/lib/output"
import { consumePublicFormRateLimit } from "@/lib/public-forms/rate-limit"

const bodySchema = z.object({ invite: z.string().min(1).max(2048) })

// Cada chamada bem-sucedida gera um token novo no Supabase: o limite evita martelar a geração.
const EXCHANGE_RATE_LIMIT = { limit: 30, windowMs: 60_000 }
const RATE_LIMITED_MESSAGE = "Muitas tentativas. Aguarde um minuto e tente novamente."
const INTERNAL_ERROR_MESSAGE = "Não foi possível validar o link agora. Tente novamente."

/** Nunca loga o convite nem o token devolvido: são credenciais de uso temporário. */
export async function POST(request: NextRequest) {
  try {
    const body = bodySchema.safeParse(await request.json().catch(() => ({})))
    if (!body.success) {
      return NextResponse.json(new Output(false, [], ["Este link é inválido. Solicite um novo link de acesso."], null), {
        status: 400,
      })
    }

    const clientIp = getTrustedClientIp(request.headers)
    const rate = await consumePublicFormRateLimit(`invite-exchange:${clientIp ?? "unknown"}`, EXCHANGE_RATE_LIMIT)
    if (!rate.allowed) {
      return NextResponse.json(new Output(false, [], [RATE_LIMITED_MESSAGE], null), { status: 429 })
    }

    const output = await createInviteLinkExchangeUseCase().exchange(body.data.invite)
    if (output.isValid) {
      return NextResponse.json(new Output(true, [], [], { tokenHash: output.result.tokenHash, type: "invite" }), {
        status: 200,
      })
    }

    const status = output.result?.reason === "unavailable" ? 503 : 400
    return NextResponse.json(output, { status })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[InviteLinkExchangeRoute][POST] Erro interno")
    return NextResponse.json(new Output(false, [], [INTERNAL_ERROR_MESSAGE], null), { status: 500 })
  }
}
