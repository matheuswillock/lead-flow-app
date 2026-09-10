import { NextResponse, type NextRequest, connection } from "next/server"
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { backofficeSubscriptionsPanelUseCase } from "@/app/api/useCases/backoffice/BackofficeSubscriptionsPanelUseCase"
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted'

/**
 * GET /api/v1/backoffice/subscriptions — painel de assinaturas (E4, §7.8).
 * Somente leitura; `getBackofficeAccess` basta (sem mutação, sem
 * `requireManagerAccess`, mesmo padrão das outras listas do módulo).
 */
export async function GET(request: NextRequest) {
  await connection()

  try {
    const result = await getBackofficeAccess(request)
    if (result.error) {
      return NextResponse.json(result.error, { status: result.status })
    }

    const output = await backofficeSubscriptionsPanelUseCase.getSummary()
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeSubscriptionsPanelRoute][GET]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
