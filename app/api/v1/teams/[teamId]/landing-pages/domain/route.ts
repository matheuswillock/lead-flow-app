import { NextRequest, NextResponse } from "next/server"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { teamLandingDomainUseCase } from "@/app/api/useCases/landingPages/TeamLandingDomainUseCase"
import { Output } from "@/lib/output"

export async function GET(request: NextRequest, { params }: { params: Promise<{ teamId: string }> }) {
  console.info("[LandingDomainRoute][GET]")
  const access = await getTeamAccess(request)
  if (access.error) return NextResponse.json(access.error, { status: access.status })
  const { teamId } = await params
  if (teamId !== access.access.teamId) return NextResponse.json(new Output(false, [], ["Acesso negado para este time"], null), { status: 403 })
  const output = await teamLandingDomainUseCase.get(access.access)
  return NextResponse.json(output, { status: output.isValid ? 200 : 403 })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ teamId: string }> }) {
  const access = await getTeamAccess(request)
  if (access.error) return NextResponse.json(access.error, { status: access.status })
  const { teamId } = await params
  if (teamId !== access.access.teamId) return NextResponse.json(new Output(false, [], ["Acesso negado para este time"], null), { status: 403 })
  const body = (await request.json().catch(() => null)) as { hostname?: string } | null
  const output = await teamLandingDomainUseCase.connect(access.access, body?.hostname ?? "")
  return NextResponse.json(output, { status: output.isValid ? 201 : 400 })
}

export async function PATCH(request: NextRequest) {
  const access = await getTeamAccess(request)
  if (access.error) return NextResponse.json(access.error, { status: access.status })
  const output = await teamLandingDomainUseCase.verify(access.access)
  return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
}

export async function DELETE(request: NextRequest) {
  const access = await getTeamAccess(request)
  if (access.error) return NextResponse.json(access.error, { status: access.status })
  const output = await teamLandingDomainUseCase.disconnect(access.access)
  return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
}
