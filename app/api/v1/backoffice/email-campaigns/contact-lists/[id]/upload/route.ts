import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { requireMasterAccess } from "@/app/api/v1/backoffice/utils/requireMasterAccess"
import { backofficeEmailContactListUseCase } from "@/app/api/useCases/backofficeEmailContactList/BackofficeEmailContactListUseCase"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10MB

function detectSourceFormat(fileName: string, contentType: string): "csv" | "json" | null {
  const lowerName = fileName.toLowerCase()
  if (lowerName.endsWith(".json") || contentType.includes("json")) return "json"
  if (lowerName.endsWith(".csv") || contentType.includes("csv") || contentType.includes("text")) return "csv"
  return null
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const result = await getBackofficeAccess(request)
    if (result.error) {
      return NextResponse.json(result.error, { status: result.status })
    }
    const denied = requireMasterAccess(result.access)
    if (denied) return denied

    if (!result.access.backofficeUserId) {
      return NextResponse.json(
        new Output(false, [], ["Usuário backoffice sem vínculo ativo"], null),
        { status: 403 }
      )
    }

    const formData = await request.formData().catch(() => null)
    if (!formData) {
      return NextResponse.json(new Output(false, [], ["Dados do formulário inválidos"], null), { status: 400 })
    }

    const file = formData.get("file")
    if (!file || typeof file === "string") {
      return NextResponse.json(new Output(false, [], ["Arquivo é obrigatório"], null), { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        new Output(false, [], ["Arquivo muito grande. Tamanho máximo: 10MB"], null),
        { status: 400 }
      )
    }

    const sourceFormat = detectSourceFormat(file.name, file.type)
    if (!sourceFormat) {
      return NextResponse.json(
        new Output(false, [], ["Formato inválido. Envie um arquivo .csv ou .json"], null),
        { status: 400 }
      )
    }

    const rawContent = await file.text()
    const output = await backofficeEmailContactListUseCase.enqueueUpload(
      id,
      sourceFormat,
      rawContent,
      result.access.backofficeUserId
    )
    return NextResponse.json(output, { status: output.isValid ? 202 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeEmailContactListUploadRoute][POST]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno ao processar arquivo"], null), { status: 500 })
  }
}
