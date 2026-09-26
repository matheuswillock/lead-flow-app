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

export async function GET(request: NextRequest, { params }: { params: Promise<{ teamId: string }> }) {
  console.info("[LandingPagesRoute][GET]")
  const resolved = await resolveAccess(request, params)
  if ("response" in resolved) return resolved.response
  const output = await landingPageUseCase.list(resolved.access)
  return NextResponse.json(output, { status: output.isValid ? 200 : 403 })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ teamId: string }> }) {
  console.info("[LandingPagesRoute][POST]")
  const resolved = await resolveAccess(request, params)
  if ("response" in resolved) return resolved.response
  const parsed = landingPageDraftSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(new Output(false, [], parsed.error.issues.map((issue) => issue.message), null), { status: 400 })
  }
  const output = await landingPageUseCase.create(resolved.access, parsed.data)
  return NextResponse.json(output, { status: output.isValid ? 201 : 400 })
}
