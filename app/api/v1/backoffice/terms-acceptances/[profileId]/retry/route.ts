import { NextResponse, type NextRequest } from "next/server"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { backofficeTermsAcceptanceUseCase } from "@/app/api/useCases/backofficeTermsAcceptance/BackofficeTermsAcceptanceUseCase"

export async function POST(request: NextRequest, { params }: { params: Promise<{ profileId: string }> }) {
  console.info("[BackofficeTermsAcceptanceRetryRoute][POST] iniciado")
  const access = await getBackofficeAccess(request)
  if (access.error) return NextResponse.json(access.error, { status: access.status })
  const { profileId } = await params
  const output = await backofficeTermsAcceptanceUseCase.retryFailedProcessing(profileId)
  return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
}
