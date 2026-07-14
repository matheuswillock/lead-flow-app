import { NextResponse, type NextRequest } from "next/server"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { backofficeTermsAcceptanceUseCase } from "@/app/api/useCases/backofficeTermsAcceptance/BackofficeTermsAcceptanceUseCase"

export async function GET(request: NextRequest, { params }: { params: Promise<{ profileId: string }> }) {
  console.info("[BackofficeTermsAcceptanceDownloadRoute][GET] iniciado")
  const access = await getBackofficeAccess(request)
  if (access.error) return NextResponse.json(access.error, { status: access.status })
  const { profileId } = await params
  const output = await backofficeTermsAcceptanceUseCase.getEvidenceDownload(profileId)
  return NextResponse.json(output, { status: output.isValid ? 200 : 404, headers: { "Cache-Control": "no-store" } })
}
