import { NextResponse, type NextRequest, connection } from "next/server"
import { Output } from "@/lib/output"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"
import { teamDeletionUseCase } from "@/app/api/useCases/teamDeletion/teamDeletionComposition"
import { withCronAudit } from "@/app/api/lib/cron/withCronAudit"
import { getDefaultCronSlackCallback } from "@/app/api/lib/cron/cronSlackCallback"

/** Gerar o ZIP e excluir o time leva mais que o padrão da plataforma. */
export const maxDuration = 300

/**
 * A cada 10 minutos: gera as exportações pendentes (e exclui o time depois de guardar o arquivo)
 * e apaga os arquivos cujo prazo de 7 dias venceu.
 */
export async function GET(request: NextRequest) {
  await connection()

  try {
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
      return NextResponse.json(new Output(false, [], ["Não autorizado"], null), { status: 401 })
    }

    const output = await withCronAudit(
      { cronKey: "team-deletion-exports", cronPath: "/api/v1/teams/cron/team-deletion-exports" },
      async () => {
        const processed = await teamDeletionUseCase.processPending()
        const purged = await teamDeletionUseCase.purgeExpired()
        return new Output(true, [], [], { ...processed, ...purged })
      },
      { onFailure: getDefaultCronSlackCallback() },
    )
    return NextResponse.json(output, { status: output.isValid ? 200 : 500 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[TeamDeletionExportsCronRoute][GET] Erro:", error)
    return NextResponse.json(new Output(false, [], ["Erro interno no cron de exportação de times"], null), {
      status: 500,
    })
  }
}
