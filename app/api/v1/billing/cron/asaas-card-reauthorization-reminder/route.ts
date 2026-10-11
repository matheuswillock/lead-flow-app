import { connection, NextResponse, type NextRequest } from "next/server"
import { getDefaultCronSlackCallback } from "@/app/api/lib/cron/cronSlackCallback"
import { withCronAudit } from "@/app/api/lib/cron/withCronAudit"
import { asaasCardReauthorizationReminderUseCase } from "@/app/api/useCases/asaasAccountMigration/asaasAccountMigrationFactory"
import { Output } from "@/lib/output"

export async function GET(request: NextRequest) {
  await connection()
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json(new Output(false, [], ["Não autorizado"], null), { status: 401 })
  }
  try {
    const output = await withCronAudit(
      {
        cronKey: "asaas-card-reauthorization-reminder",
        cronPath: "/api/v1/billing/cron/asaas-card-reauthorization-reminder",
      },
      () => asaasCardReauthorizationReminderUseCase.execute(),
      { onFailure: getDefaultCronSlackCallback() },
    )
    return NextResponse.json(output, { status: output.isValid ? 200 : 500 })
  } catch (error) {
    console.error("[AsaasCardReauthorizationReminderCronRoute][GET] Erro:", error)
    return NextResponse.json(
      new Output(false, [], ["Erro interno nos lembretes de reautorização"], null),
      { status: 500 },
    )
  }
}
