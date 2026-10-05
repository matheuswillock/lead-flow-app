import { NextRequest, NextResponse } from "next/server"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { landingPageAssetUseCase } from "@/app/api/useCases/landingPageAssets/LandingPageAssetUseCase"
import { Output } from "@/lib/output"

export async function POST(request: NextRequest, { params }: { params: Promise<{ teamId: string }> }) {
  console.info("[LandingPageAssetsRoute][POST]")
  const resolved = await getTeamAccess(request)
  if (resolved.error) return NextResponse.json(resolved.error, { status: resolved.status })
  const { teamId } = await params
  if (teamId !== resolved.access.teamId) return NextResponse.json(new Output(false, [], ["Acesso negado para este time"], null), { status: 403 })
  const formData = await request.formData().catch(() => null)
  const asset = formData?.get("asset")
  if (!(asset instanceof File)) return NextResponse.json(new Output(false, [], ["Envie um arquivo de imagem"], null), { status: 400 })
  const output = await landingPageAssetUseCase.upload(resolved.access, asset)
  return NextResponse.json(output, { status: output.isValid ? 201 : 400 })
}
