import { NextResponse, type NextRequest, connection } from "next/server";
import { Output } from "@/lib/output"
import { EmailContactImportUseCase } from "@/app/api/useCases/email/EmailContactImportUseCase"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"
import { withCronAudit } from "@/app/api/lib/cron/withCronAudit"
import { getDefaultCronSlackCallback } from "@/app/api/lib/cron/cronSlackCallback"

export const maxDuration = 60

export async function GET(request: NextRequest) {
  await connection();

  try {
    const authHeader = request.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(new Output(false, [], ["Não autorizado"], null), { status: 401 })
    }

    const result = await withCronAudit(
      {
        cronKey: "email-import",
        cronPath: "/api/v1/email/cron/process-import-jobs",
      },
      async () => {
        const useCase = EmailContactImportUseCase.forImportCron()
        return useCase.processPendingJobs()
      },
      {
        onFailure: getDefaultCronSlackCallback(),
      }
    )

    return NextResponse.json(result, { status: result.isValid ? 200 : 500 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[EmailCronProcessImportJobsRoute][GET]", error)
    return NextResponse.json(
      new Output(false, [], ["Erro interno no cron de importação"], null),
      { status: 500 }
    )
  }
}
