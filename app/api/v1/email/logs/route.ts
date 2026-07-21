import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { prisma } from "@/app/api/infra/data/prisma"
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';
import { resolveCampaignIdsIncludingSubs } from "@/lib/email/resolve-campaign-query-ids"

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export async function GET(request: NextRequest) {
  try {
    const teamAccess = await getTeamAccess(request)
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status })
    }

    const { searchParams } = new URL(request.url)
    const page = parsePositiveInt(searchParams.get("page"), 1)
    const pageSize = Math.min(parsePositiveInt(searchParams.get("pageSize"), 20), 100)
    const search = searchParams.get("search") ?? undefined
    const campaignId = searchParams.get("campaignId") ?? undefined
    const category = searchParams.get("category") ?? undefined
    const statusParams = searchParams
      .getAll("status")
      .flatMap((value) => value.split(","))
      .map((value) => value.trim())
      .filter(Boolean)
    const uniqueStatuses = Array.from(new Set(statusParams))
    const from = searchParams.get("from") ?? undefined
    const to = searchParams.get("to") ?? undefined

    const campaignIds = campaignId
      ? await resolveCampaignIdsIncludingSubs(teamAccess.access.teamId, campaignId)
      : null

    const where = {
      teamId: teamAccess.access.teamId,
      ...(search && {
        OR: [
          { recipientEmail: { contains: search, mode: "insensitive" as const } },
          { recipientName: { contains: search, mode: "insensitive" as const } },
        ],
      }),
      ...(campaignIds && {
        campaignId: campaignIds.length === 1 ? campaignIds[0] : { in: campaignIds },
      }),
      ...(category && { category: category as never }),
      ...(uniqueStatuses.length === 1 && { status: uniqueStatuses[0] as never }),
      ...(uniqueStatuses.length > 1 && { status: { in: uniqueStatuses as never[] } }),
      ...((from || to) && {
        sentAt: {
          ...(from && { gte: new Date(from) }),
          ...(to && { lte: new Date(to) }),
        },
      }),
    }

    const [logs, total] = await prisma.$transaction([
      prisma.emailLog.findMany({
        where,
        select: {
          id: true,
          recipientEmail: true,
          recipientName: true,
          subject: true,
          category: true,
          sourceType: true,
          sourceId: true,
          status: true,
          sentAt: true,
          deliveredAt: true,
          openedAt: true,
          clickedAt: true,
          bouncedAt: true,
          campaignId: true,
          dispatchId: true,
          campaign: { select: { id: true, name: true } },
          dispatch: {
            select: {
              contactListName: true,
              radarSegmentSlug: true,
            },
          },
        },
        orderBy: { sentAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.emailLog.count({ where }),
    ])

    return NextResponse.json(
      new Output(true, [], [], {
        logs,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      }),
      { status: 200 }
    )
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[EmailLogsRoute][GET]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
