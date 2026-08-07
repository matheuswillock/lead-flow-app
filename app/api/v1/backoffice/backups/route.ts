import { NextResponse, type NextRequest, connection } from "next/server";
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { requireManagerAccess } from "@/app/api/v1/backoffice/utils/requireManagerAccess"
import { backofficeDatabaseBackupUseCase } from "@/app/api/useCases/backofficeDatabaseBackup/BackofficeDatabaseBackupUseCase"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"

export const maxDuration = 300

export async function GET(request: NextRequest) {
  await connection();

  try {
    const accessResult = await getBackofficeAccess(request)
    if (accessResult.error) {
      return NextResponse.json(accessResult.error, { status: accessResult.status })
    }

    const output = await backofficeDatabaseBackupUseCase.list()
    return NextResponse.json(output, { status: output.isValid ? 200 : 500 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeBackupsRoute][GET]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const accessResult = await getBackofficeAccess(request)
    if (accessResult.error) {
      return NextResponse.json(accessResult.error, { status: accessResult.status })
    }

    const denied = requireManagerAccess(accessResult.access)
    if (denied) return denied

    const output = await backofficeDatabaseBackupUseCase.triggerManualBackup(
      accessResult.access.profileId
    )
    if (output.isValid) {
      return NextResponse.json(output, { status: 200 })
    }

    const message = output.errorMessages[0] ?? ""
    const status = message.includes("em andamento") ? 409 : 500
    return NextResponse.json(output, { status })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeBackupsRoute][POST]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
