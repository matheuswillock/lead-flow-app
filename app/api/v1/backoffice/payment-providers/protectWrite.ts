import { NextResponse, type NextRequest } from "next/server"
import { consumeBillingRateLimit } from "@/lib/billing/billing-rate-limit"

export async function protectPaymentProviderWrite(
  request: NextRequest,
  profileId: string,
): Promise<NextResponse | null> {
  const origin = request.headers.get("origin")
  try {
    if (!origin || new URL(origin).origin !== request.nextUrl.origin) {
      return NextResponse.json({ error: "Origem da requisição inválida" }, { status: 403 })
    }
  } catch {
    return NextResponse.json({ error: "Origem da requisição inválida" }, { status: 403 })
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  const result = await consumeBillingRateLimit(
    `payment-provider-write:${profileId}:${ip}`,
    { limit: 20, windowMs: 60_000 },
  )
  if (result.allowed) return null
  return NextResponse.json({ error: "Muitas alterações. Aguarde antes de tentar novamente." }, {
    status: 429,
    headers: { "Retry-After": String(result.retryAfterSeconds) },
  })
}
