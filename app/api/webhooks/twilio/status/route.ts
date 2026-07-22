import { NextRequest, NextResponse } from "next/server"
import { DialerRepository } from "@/app/api/infra/data/repositories/dialer/DialerRepository"
import { decryptDialerSecret } from "@/lib/dialer/secret-crypto"
import { validateTwilioWebhook, parseTwilioFormBody } from "@/lib/webhooks/twilioWebhookSecurity"
import { getFullUrl } from "@/lib/utils/app-url"

const dialerRepository = new DialerRepository()

export async function POST(request: NextRequest) {
  const url = new URL(request.url)
  const teamId = url.searchParams.get("teamId")

  if (!teamId) {
    return new NextResponse("Bad Request", { status: 400 })
  }

  const params = await parseTwilioFormBody(request)
  const signature = request.headers.get("x-twilio-signature") ?? ""
  const fullUrl = getFullUrl(`/api/webhooks/twilio/status${url.search}`)

  const team = await dialerRepository.findTeamTwilioToken(teamId)
  const decryptedToken = decryptDialerSecret(team?.twilioSubaccountToken)

  if (!decryptedToken || !validateTwilioWebhook(decryptedToken, signature, fullUrl, params)) {
    console.error("[TwilioStatusWebhook][POST] Assinatura inválida", { teamId })
    return new NextResponse("Forbidden", { status: 403 })
  }

  // Estágio 3 — processamento de eventos de chamada (atualiza DialerCall, soma minutos,
  // dispara próxima discagem, broadcast) será implementado aqui
  return new NextResponse("OK", { status: 200 })
}
