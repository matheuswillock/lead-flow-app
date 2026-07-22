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
    return new NextResponse("<Response/>", {
      status: 400,
      headers: { "Content-Type": "text/xml" },
    })
  }

  const params = await parseTwilioFormBody(request)
  const signature = request.headers.get("x-twilio-signature") ?? ""
  const fullUrl = getFullUrl(`/api/webhooks/twilio/voice${url.search}`)

  const team = await dialerRepository.findTeamTwilioToken(teamId)
  const decryptedToken = decryptDialerSecret(team?.twilioSubaccountToken)

  if (!decryptedToken || !validateTwilioWebhook(decryptedToken, signature, fullUrl, params)) {
    console.error("[TwilioVoiceWebhook][POST] Assinatura inválida", { teamId })
    return new NextResponse("Forbidden", { status: 403 })
  }

  // Estágio 3 — lógica de discagem (TwiML Conference) será implementada aqui
  return new NextResponse("<Response/>", {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  })
}
