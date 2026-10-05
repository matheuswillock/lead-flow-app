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
  return NextResponse.json(output, { status: output.isValid ? 202 : 400 })
}
