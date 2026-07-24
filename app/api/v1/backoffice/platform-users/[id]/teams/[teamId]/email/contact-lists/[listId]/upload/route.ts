import { type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"
import { backofficeStudioEmailUseCase } from "@/app/api/useCases/backofficeStudioEmail/BackofficeStudioEmailUseCase"
import {
  resolveStudioEmailActor,
  studioEmailError,
  studioEmailJson,
  type StudioEmailRouteParams,
} from "@/app/api/v1/backoffice/utils/studioEmailRoute"

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024

type RouteContext = { params: Promise<StudioEmailRouteParams & { listId: string }> }

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const all = await params
    const resolved = await resolveStudioEmailActor(request, Promise.resolve(all))
    if (resolved.error) return resolved.error

    const formData = await request.formData().catch(() => null)
    if (!formData) {
      return studioEmailJson(new Output(false, [], ["Dados do formulário inválidos"], null))
    }
    const file = formData.get("file")
    if (!file || typeof file === "string") {
      return studioEmailJson(new Output(false, [], ["Arquivo CSV é obrigatório"], null))
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return studioEmailJson(new Output(false, [], ["Arquivo muito grande. Tamanho máximo: 10MB"], null))
    }
    const csvContent = await file.text()
    if (!csvContent.trim()) {
      return studioEmailJson(new Output(false, [], ["Arquivo CSV está vazio"], null))
    }
    const output = await backofficeStudioEmailUseCase.uploadContactsCsv(
      resolved.actor,
      all.listId,
      csvContent
    )
    return studioEmailJson(output)
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeStudioEmailContactUploadRoute][POST]", error)
    return studioEmailError(["Erro interno"])
  }
}
