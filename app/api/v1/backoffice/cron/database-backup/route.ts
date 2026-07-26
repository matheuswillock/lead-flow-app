import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { backofficeDatabaseBackupUseCase } from "@/app/api/useCases/backofficeDatabaseBackup/BackofficeDatabaseBackupUseCase"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"

export const maxDuration = 300

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(new Output(false, [], ["Não autorizado"], null), { status: 401 })
    }

    const output = await backofficeDatabaseBackupUseCase.triggerCronBackup()
    return NextResponse.json(output, { status: output.isValid ? 200 : 500 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeCronDatabaseBackupRoute][GET]", error)
    return NextResponse.json(
      new Output(false, [], ["Erro interno no cron de backup"], null),
      { status: 500 }
    )
  }
}
