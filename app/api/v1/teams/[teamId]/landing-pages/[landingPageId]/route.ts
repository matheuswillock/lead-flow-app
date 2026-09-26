import { NextRequest, NextResponse } from "next/server"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { landingPageUseCase } from "@/app/api/useCases/landingPages/LandingPageUseCase"
import { landingPageDraftSchema } from "@/lib/landing-pages/validation"
import { Output } from "@/lib/output"

async function resolveAccess(request: NextRequest, params: Promise<{ teamId: string }>) {
  const resolved = await getTeamAccess(request)
  if (resolved.error) return { response: NextResponse.json(resolved.error, { status: resolved.status }) }
  const { teamId } = await params
  if (teamId !== resolved.access.teamId) {
    return { response: NextResponse.json(new Output(false, [], ["Acesso negado para este time"], null), { status: 403 }) }
  }
  return { access: resolved.access }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ teamId: string; landingPageId: string }> }) {
  console.info("[LandingPageRoute][GET]")
  const resolved = await resolveAccess(request, params)
  if ("response" in resolved) return resolved.response
  const { landingPageId } = await params
  const output = await landingPageUseCase.get(resolved.access, landingPageId)
  return NextResponse.json(output, { status: output.isValid ? 200 : 404 })
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ teamId: string; landingPageId: string }> }) {
  console.info("[LandingPageRoute][PUT]")
  const resolved = await resolveAccess(request, params)
  if ("response" in resolved) return resolved.response
  const { landingPageId } = await params
  const parsed = landingPageDraftSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(new Output(false, [], parsed.error.issues.map((issue) => issue.message), null), { status: 400 })
  }
  const output = await landingPageUseCase.update(resolved.access, landingPageId, parsed.data)
  return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ teamId: string; landingPageId: string }> }) {
  console.info("[LandingPageRoute][POST]")
  const resolved = await resolveAccess(request, params)
  if ("response" in resolved) return resolved.response
  const { landingPageId } = await params
  const action = new URL(request.url).searchParams.get("action")
  const output = action === "archive"
    ? await landingPageUseCase.archive(resolved.access, landingPageId)
    : await landingPageUseCase.publish(resolved.access, landingPageId)
  return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
}
