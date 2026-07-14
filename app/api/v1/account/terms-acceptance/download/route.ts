import { NextResponse, type NextRequest } from "next/server"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { backofficeTermsAcceptanceUseCase } from "@/app/api/useCases/backofficeTermsAcceptance/BackofficeTermsAcceptanceUseCase"

export async function GET(request: NextRequest) {
  console.info("[AccountTermsAcceptanceDownloadRoute][GET] iniciado")
  const teamAccess = await getTeamAccess(request)
  if (teamAccess.error) return NextResponse.json(teamAccess.error, { status: teamAccess.status })
  const output = await backofficeTermsAcceptanceUseCase.getEvidenceDownload(teamAccess.access.profileId)
  return NextResponse.json(output, { status: output.isValid ? 200 : 404, headers: { "Cache-Control": "no-store" } })
}
