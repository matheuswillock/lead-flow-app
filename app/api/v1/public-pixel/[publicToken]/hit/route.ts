import { NextResponse, type NextRequest } from "next/server"
import { radarPixelHitUseCase } from "@/app/api/useCases/radar/RadarPixelHitUseCase"
import { radarPixelRequestFingerprint } from "@/lib/radar/pixel-rate-limit"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ publicToken: string }> },
) {
  const { publicToken } = await params
  return handlePixelHit(request, publicToken, "pixel.pageview")
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ publicToken: string }> },
) {
  try {
    const { publicToken } = await params
    let eventType = "pixel.pageview"
    try {
      const body: unknown = await request.json()
      if (
        body &&
        typeof body === "object" &&
        "eventType" in body &&
        typeof (body as Record<string, unknown>).eventType === "string"
      ) {
        eventType = (body as Record<string, unknown>).eventType as string
      }
    } catch {
      // body is optional
    }
    return handlePixelHit(request, publicToken, eventType)
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[RadarPixelHitRoute][POST]", error)
    return NextResponse.json({ error: "internal_error" }, { status: 500 })
  }
}

async function handlePixelHit(
  request: NextRequest,
  publicToken: string,
  eventType: string,
): Promise<NextResponse> {
  try {
    const origin = request.headers.get("origin")
    const fingerprint = radarPixelRequestFingerprint(request)
    const visitorSession =
      request.nextUrl.searchParams.get("vs") ??
      request.headers.get("x-visitor-session") ??
      crypto.randomUUID()

    const output = await radarPixelHitUseCase.execute({
      publicToken,
      eventType,
      origin,
      fingerprint,
      visitorSession,
      userAgent: request.headers.get("user-agent"),
    })

    if (!output.isValid) {
      const result = output.result as { status: string; retryAfterSeconds?: number } | null
      const status = result?.status

      if (status === "not_found" || status === "feature_disabled") {
        return NextResponse.json({ error: "not_found" }, { status: 404 })
      }
      if (status === "origin_not_allowed") {
        return NextResponse.json({ error: "origin_not_allowed" }, { status: 403 })
      }
      if (status === "rate_limited" && result?.retryAfterSeconds !== undefined) {
        return NextResponse.json(
          { error: "rate_limited" },
          { status: 429, headers: { "Retry-After": String(result.retryAfterSeconds) } },
        )
      }
      return NextResponse.json({ error: "error" }, { status: 400 })
    }

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[RadarPixelHitRoute][handlePixelHit]", error)
    return NextResponse.json({ error: "internal_error" }, { status: 500 })
  }
}
