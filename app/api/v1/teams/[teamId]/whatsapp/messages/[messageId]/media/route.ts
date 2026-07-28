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

  const code = (output.result as { code?: string } | null)?.code

  if (!output.isValid) {
    if (code === "MEDIA_PROCESSING") {
      return NextResponse.json(output, { status: 202 })
    }
    if (code === "MEDIA_EXPIRED") {
      return NextResponse.json(output, { status: 410 })
    }
    if (code === "MEDIA_UNAVAILABLE") {
      const retryable = (output.result as { retryable?: boolean } | null)?.retryable
      return NextResponse.json(output, { status: retryable ? 503 : 422 })
    }
    if (code === "ACCESS_DENIED" || output.errorMessages.some((m) => m.includes("Acesso negado"))) {
      return NextResponse.json(output, { status: 403 })
    }
    return NextResponse.json(output, { status: 404 })
  }

  const result = output.result as Record<string, unknown>

  if (typeof result.redirectUrl === "string") {
    return NextResponse.redirect(result.redirectUrl)
  }

  if (typeof result.base64 !== "string") {
    return NextResponse.json(
      new Output(false, [], ["Mídia indisponível"], { code: "MEDIA_UNAVAILABLE" }),
      { status: 422 }
    )
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
