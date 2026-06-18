import { NextRequest, NextResponse } from "next/server"
import { Output } from "@/lib/output"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { listConversationsUseCase } from "@/app/api/useCases/whatsapp/ListConversationsUseCase"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params
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

  const url = new URL(request.url)
  const leadId = url.searchParams.get("leadId") ?? undefined
  const assignedProfileId = url.searchParams.get("assignedProfileId") ?? undefined
  const hasUnreadParam = url.searchParams.get("hasUnread")
  const hasUnread = hasUnreadParam === "true" ? true : hasUnreadParam === "false" ? false : undefined
  const search = url.searchParams.get("search") ?? undefined
  const page = parseInt(url.searchParams.get("page") ?? "1", 10)
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "20", 10), 100)

  const output = await listConversationsUseCase.execute({
    teamId,
    leadId,
    assignedProfileId,
    hasUnread,
    search,
    page,
    limit,
  })

  if (!output.isValid) {
    return NextResponse.json(output, { status: 500 })
  }

  return NextResponse.json(output)
}
