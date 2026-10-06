import { NextResponse } from "next/server"
import { landingAnalyticsUseCase } from "@/app/api/useCases/landingAnalytics/LandingAnalyticsUseCase"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ publicId: string }> },
) {
  const { publicId } = await params
  const output = await landingAnalyticsUseCase.record(
    publicId,
    await request.json().catch(() => null),
    request,
  )
  const isConflict = output.errorMessages.some((message) => message.includes("eventId já utilizado"))
  const isRateLimited = output.errorMessages.some((message) => message.includes("Limite de eventos"))
  return NextResponse.json(output, {
    status: output.isValid ? 202 : isConflict ? 409 : isRateLimited ? 429 : 400,
    ...(isRateLimited && output.result?.retryAfterSeconds
      ? { headers: { "Retry-After": String(output.result.retryAfterSeconds) } }
      : {}),
  })
}
