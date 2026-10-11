import { connection, NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { withCronAudit } from "@/app/api/lib/cron/withCronAudit"
import { getDefaultCronSlackCallback } from "@/app/api/lib/cron/cronSlackCallback"
import { asaasDueDateCutoverUseCase } from "@/app/api/useCases/asaasAccountMigration/asaasAccountMigrationFactory"

export async function GET(request: NextRequest) {
  await connection()
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json(new Output(false, [], ["Não autorizado"], null), { status: 401 })
  }
  try {
    const output = await withCronAudit(
      { cronKey: "asaas-due-date-cutover", cronPath: "/api/v1/billing/cron/asaas-due-date-cutover" },
      () => asaasDueDateCutoverUseCase.execute(),
      { onFailure: getDefaultCronSlackCallback() }
    )
    return NextResponse.json(output, { status: output.isValid ? 200 : 500 })
  } catch (error) {
    console.error("[AsaasDueDateCutoverCronRoute][GET] Erro:", error)
    return NextResponse.json(new Output(false, [], ["Erro interno no corte Asaas"], null), { status: 500 })
  }
}
