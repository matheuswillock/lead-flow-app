import { NextRequest, NextResponse } from "next/server"
import { Output } from "@/lib/output"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { getMessageMediaUseCase } from "@/app/api/useCases/whatsapp/GetMessageMediaUseCase"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; messageId: string }> }
) {
  const { teamId, messageId } = await params
  const teamAccess = await getTeamAccess(request)
  if ("error" in teamAccess) {
    return NextResponse.json(teamAccess.error, { status: teamAccess.status })
  }

  if (teamAccess.access.teamId !== teamId) {
    return NextResponse.json(
      new Output(false, [], ["Acesso negado a este time"], null),
      { status: 403 }
    )
  }

  const output = await getMessageMediaUseCase.execute({
    teamId,
    messageId,
    access: teamAccess.access,
  })
  if (!output.isValid || !output.result) {
    const status = output.errorMessages.some((m) => m.includes("Acesso negado")) ? 403 : 404
    return NextResponse.json(output, { status })
  }

  const result = output.result as Record<string, unknown>

  if (typeof result.redirectUrl === "string") {
    return NextResponse.redirect(result.redirectUrl)
  }

  if (typeof result.base64 !== "string") {
    return NextResponse.json(output, { status: 404 })
  }

  const mimeType = typeof result.mimeType === "string" ? result.mimeType : "application/octet-stream"
  const fileName = typeof result.fileName === "string" ? result.fileName : "arquivo"
  const buffer = Buffer.from(result.base64, "base64")

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": mimeType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(fileName)}"`,
      "Cache-Control": "private, max-age=3600",
    },
  })
}
