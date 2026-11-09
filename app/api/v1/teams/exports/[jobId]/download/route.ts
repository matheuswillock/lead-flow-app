import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"
import { getAuthenticatedSupabaseId } from "@/app/api/v1/utils/getAuthenticatedSupabaseId"
import { teamDeletionUseCase } from "@/app/api/useCases/teamDeletion/teamDeletionComposition"

const STATUS_BY_CODE: Record<string, number> = { not_found: 404, not_ready: 409, expired: 410 }

/**
 * Link do e-mail da exportação: só funciona logado e só para quem pediu. Em vez de expor o arquivo,
 * confere o dono e redireciona para um link assinado que vale poucos minutos.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const auth = await getAuthenticatedSupabaseId(request)
    if (auth.error) {
      // Quem clicou no e-mail sem sessão entra e clica no link de novo (o e-mail continua valendo).
      if (auth.status === 401) return NextResponse.redirect(new URL("/sign-in", request.url))
      return NextResponse.json(auth.error, { status: auth.status })
    }

    const { jobId } = await params
    const output = await teamDeletionUseCase.createDownloadUrlForUser({ jobId, supabaseId: auth.supabaseId })
    if (!output.isValid) {
      const code = (output.result as { code?: string } | null)?.code ?? "not_found"
      return NextResponse.json(output, { status: STATUS_BY_CODE[code] ?? 404 })
    }

    const { url } = output.result as { url: string }
    return NextResponse.redirect(url)
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[TeamExportDownloadRoute][GET] Erro:", error)
    return NextResponse.json(new Output(false, [], ["Erro interno ao baixar a exportação"], null), { status: 500 })
  }
}
