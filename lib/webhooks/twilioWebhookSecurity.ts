import twilio from "twilio"

/**
 * Valida a assinatura do webhook Twilio usando o auth token da SUBconta (já decifrado).
 * fullUrl deve incluir a query string exata (getFullUrl + new URL(request.url).search).
 * params deve ser o body form-urlencoded parseado como Record<string, string>.
 */
export function validateTwilioWebhook(
  decryptedSubaccountToken: string,
  signature: string,
  fullUrl: string,
  params: Record<string, string>,
): boolean {
  return twilio.validateRequest(decryptedSubaccountToken, signature, fullUrl, params)
}

export async function parseTwilioFormBody(
  request: Request,
): Promise<Record<string, string>> {
  const text = await request.text()
  const entries = new URLSearchParams(text)
  const result: Record<string, string> = {}
  entries.forEach((value, key) => {
    result[key] = value
  })
  return result
}
