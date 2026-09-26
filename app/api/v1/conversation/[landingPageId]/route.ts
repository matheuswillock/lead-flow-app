import { NextResponse } from "next/server"
import { landingPageUseCase } from "@/app/api/useCases/landingPages/LandingPageUseCase"
import { rejectLandingPageRequestOnForeignHost } from "@/lib/landing-pages/landing-page-host-tenancy"

export async function GET(request: Request, { params }: { params: Promise<{ landingPageId: string }> }) {
  const { landingPageId } = await params
  const foreignHost = await rejectLandingPageRequestOnForeignHost(request, landingPageId)
  if (foreignHost) return foreignHost
  const output = await landingPageUseCase.getPublic(landingPageId)
  return NextResponse.json(output, {
    status: output.isValid ? 200 : 404,
    headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" },
  })
}
