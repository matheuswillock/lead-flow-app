import { NextResponse, type NextRequest } from "next/server"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { backofficeTermsAcceptanceUseCase } from "@/app/api/useCases/backofficeTermsAcceptance/BackofficeTermsAcceptanceUseCase"
import { Output } from "@/lib/output"

export async function GET(request: NextRequest) {
  console.info("[BackofficeLegalDocumentsRoute][GET] iniciado")
  const access = await getBackofficeAccess(request)
  if (access.error) return NextResponse.json(access.error, { status: access.status })
  const output = await backofficeTermsAcceptanceUseCase.listLegalDocuments()
  return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
}

export async function POST(request: NextRequest) {
  console.info("[BackofficeLegalDocumentsRoute][POST] iniciado")
  const access = await getBackofficeAccess(request)
  if (access.error) return NextResponse.json(access.error, { status: access.status })
  if (!access.access.fullAccess) return NextResponse.json(new Output(false, [], ["Apenas administradores podem criar documentos jurídicos"], null), { status: 403 })
  const output = await backofficeTermsAcceptanceUseCase.createLegalDocument({ ...(await request.json()), actorBackofficeUserId: access.access?.backofficeUserId ?? null })
  return NextResponse.json(output, { status: output.isValid ? 201 : 400 })
}
