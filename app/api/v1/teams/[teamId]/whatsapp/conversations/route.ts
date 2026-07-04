import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { Output } from "@/lib/output"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { listConversationsUseCase } from "@/app/api/useCases/whatsapp/ListConversationsUseCase"
import { createConversationUseCase } from "@/app/api/useCases/whatsapp/CreateConversationUseCase"

const createConversationSchema = z.object({
  phone: z.string().min(8),
  contactName: z.string().trim().min(1).optional(),
  initialMessage: z.string().trim().min(1).optional(),
})

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
  const isArchivedParam = url.searchParams.get("isArchived")
  const isArchived = isArchivedParam === "true" ? true : isArchivedParam === "false" ? false : undefined
  const search = url.searchParams.get("search") ?? undefined
  const tagIdsParam = url.searchParams.get("tagIds")
  const tagIds = tagIdsParam
    ? tagIdsParam.split(",").map((id) => id.trim()).filter(Boolean)
    : undefined
  const page = parseInt(url.searchParams.get("page") ?? "1", 10)
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "20", 10), 100)

  const output = await listConversationsUseCase.execute({
    teamId,
    access: teamAccess.access,
    leadId,
    assignedProfileId,
    hasUnread,
    isArchived,
    search,
    tagIds,
    page,
    limit,
  })

  if (!output.isValid) {
    return NextResponse.json(output, { status: 500 })
  }

  return NextResponse.json(output)
}

export async function POST(
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

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      new Output(false, [], ["Corpo da requisição inválido"], null),
      { status: 400 }
    )
  }

  const parsed = createConversationSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      new Output(false, [], parsed.error.issues.map((issue) => issue.message), null),
      { status: 400 }
    )
  }

  const output = await createConversationUseCase.execute({
    teamId,
    profileId: teamAccess.access.profileId,
    phone: parsed.data.phone,
    contactName: parsed.data.contactName,
    initialMessage: parsed.data.initialMessage,
  })

  if (!output.isValid) {
    return NextResponse.json(output, { status: 400 })
  }

  return NextResponse.json(output, { status: 201 })
}
