import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { prisma } from "@/app/api/infra/data/prisma"
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';

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
    const status = searchParams.get("status") ?? undefined
    const from = searchParams.get("from") ?? undefined
    const to = searchParams.get("to") ?? undefined

    const where = {
      teamId: teamAccess.access.teamId,
      ...(search && {
        OR: [
          { recipientEmail: { contains: search, mode: "insensitive" as const } },
          { subject: { contains: search, mode: "insensitive" as const } },
        ],
      }),
      ...(campaignId && { campaignId }),
      ...(category && { category: category as never }),
      ...(status && { status: status as never }),
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
          campaign: { select: { id: true, name: true } },
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
