import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { backofficeEmailTemplatesUseCase } from "@/app/api/useCases/backofficeEmailTemplates/BackofficeEmailTemplatesUseCase"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const result = await getBackofficeAccess(request)
    if (result.error) {
      return NextResponse.json(result.error, { status: result.status })
    }
    const { id } = await params
    const output = await backofficeEmailTemplatesUseCase.publish(id)
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    console.error("[BackofficeEmailTemplatePublishRoute][POST]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
