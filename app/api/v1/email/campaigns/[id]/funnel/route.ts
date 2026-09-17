import { NextResponse, type NextRequest, connection } from "next/server"
import { Output } from "@/lib/output"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"
import {
  CAMPAIGN_FUNNEL_NOT_FOUND_MESSAGE,
  emailAnalyticsUseCase,
} from "@/app/api/useCases/email/EmailAnalyticsUseCase"

type ParsedDate = { ok: true; value: Date | undefined } | { ok: false }

/**
 * Ausente e malformado não são a mesma coisa.
 *
 * Tratar os dois como `undefined` fazia um `from` com erro de digitação devolver
 * 200 com o funil da campanha inteira — uma resposta muito mais ampla que a
 * pedida, e sem nenhum sinal de que o filtro foi ignorado.
 */
function parseDate(value: string | null): ParsedDate {
  if (!value) return { ok: true, value: undefined }
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? { ok: false } : { ok: true, value: parsed }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  await connection()

  try {
    const teamAccess = await getTeamAccess(request)
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status })
    }

    const { id } = await context.params
    const { searchParams } = new URL(request.url)

    const from = parseDate(searchParams.get("from"))
    const to = parseDate(searchParams.get("to"))
    if (!from.ok || !to.ok) {
      return NextResponse.json(
        new Output(false, [], ["Período inválido: use datas ISO 8601 em 'from' e 'to'"], null),
        { status: 400 },
      )
    }

    // Sem período, o funil cobre a campanha inteira — é a pergunta natural
    // ("o que esta campanha produziu?"), não "o que ela produziu nos 30 dias".
    const result = await emailAnalyticsUseCase.getCampaignFunnel({
      teamId: teamAccess.access.teamId,
      campaignId: id,
      from: from.value,
      to: to.value,
    })

    if (result.isValid) {
      return NextResponse.json(result, { status: 200 })
    }

    // Falha de infraestrutura não pode se passar por campanha inexistente.
    const notFound = result.errorMessages.includes(CAMPAIGN_FUNNEL_NOT_FOUND_MESSAGE)
    return NextResponse.json(result, { status: notFound ? 404 : 500 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[EmailCampaignFunnelRoute][GET]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
