import { NextResponse, type NextRequest, connection } from "next/server"
import { Output } from "@/lib/output"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"
import { asaasDualAccountReconciliationUseCase } from "@/app/api/useCases/asaasAccountMigration/AsaasDualAccountReconciliationUseCase"
import { withCronAudit } from "@/app/api/lib/cron/withCronAudit"
import { getDefaultCronSlackCallback } from "@/app/api/lib/cron/cronSlackCallback"

/**
 * E7 (X3, T-30.25) — 30 — Migração de Conta (execução). Cron diário
 * enquanto a janela dual durar: reconcilia banco × as duas contas Asaas
 * (via reuso do inventário read-only de E1) e varre o ledger por linhas
 * presas fora dos estados terminais há mais de 24h. Ambos os sinais viram
 * alerta Sentry — nunca falha silenciosa (X3). Desativar junto com a
 * remoção da chave legada em E9 (mesmo PR).
 */
export async function GET(request: NextRequest) {
  await connection()

  try {
    const authHeader = request.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(new Output(false, [], ["Não autorizado"], null), { status: 401 })
    }

    const output = await withCronAudit(
      {
        cronKey: "asaas-dual-account-reconciliation",
        cronPath: "/api/v1/billing/cron/asaas-dual-account-reconciliation",
      },
      () => asaasDualAccountReconciliationUseCase.execute(),
      { onFailure: getDefaultCronSlackCallback() }
    )
    return NextResponse.json(output, { status: output.isValid ? 200 : 500 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[AsaasDualAccountReconciliationCronRoute][GET] Erro:", error)
    return NextResponse.json(
      new Output(false, [], ["Erro interno no cron de reconciliação Asaas"], null),
      { status: 500 }
    )
  }
}
