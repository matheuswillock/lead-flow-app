import { NextResponse, type NextRequest, connection } from "next/server";
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { requireManagerAccess } from "@/app/api/v1/backoffice/utils/requireManagerAccess"
import { backofficeDatabaseBackupUseCase } from "@/app/api/useCases/backofficeDatabaseBackup/BackofficeDatabaseBackupUseCase"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await connection();

  try {
    const accessResult = await getBackofficeAccess(request)
    if (accessResult.error) {
      return NextResponse.json(accessResult.error, { status: accessResult.status })
    }

    const denied = requireManagerAccess(accessResult.access)
    if (denied) return denied

    const { id } = await params
    const result = await backofficeDatabaseBackupUseCase.getDownloadStream(id)
    if (!result.ok) {
      return NextResponse.json(new Output(false, [], [result.message], null), {
        status: result.status,
      })
    }

    return new NextResponse(result.body, {
      status: 200,
      headers: {
        "Content-Type": result.contentType,
        "Content-Disposition": `attachment; filename="${result.fileName}"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeBackupDownloadRoute][GET]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
