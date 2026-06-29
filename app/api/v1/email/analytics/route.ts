import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { prisma } from "@/app/api/infra/data/prisma"
import { addDaysInTz, startOfDayInTz } from "@/lib/dates"
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';

function getDefaultFrom(tz: string): Date {
  return startOfDayInTz(addDaysInTz(new Date(), -30, tz), tz)
}

export async function GET(request: NextRequest) {
  try {
    const teamAccess = await getTeamAccess(request)
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status })
    }

    const { searchParams } = new URL(request.url)
    const fromParam = searchParams.get("from")
    const toParam = searchParams.get("to")
    const campaignId = searchParams.get("campaignId") ?? undefined

    const from = fromParam ? new Date(fromParam) : getDefaultFrom(teamAccess.access.userTimezone)
    const to = toParam ? new Date(toParam) : new Date()

    const where = {
      teamId: teamAccess.access.teamId,
      sentAt: { gte: from, lte: to },
      ...(campaignId && { campaignId }),
    }

    const [total, delivered, opened, clicked, bounced, complained] = await Promise.all([
      prisma.emailLog.count({ where }),
      prisma.emailLog.count({ where: { ...where, deliveredAt: { not: null } } }),
      prisma.emailLog.count({ where: { ...where, openedAt: { not: null } } }),
      prisma.emailLog.count({ where: { ...where, clickedAt: { not: null } } }),
      prisma.emailLog.count({ where: { ...where, bouncedAt: { not: null } } }),
      prisma.emailLog.count({ where: { ...where, complainedAt: { not: null } } }),
    ])

    const safe = (n: number, d: number) => (d === 0 ? 0 : Math.round((n / d) * 10000) / 100)

    // Buscar dados diários para o gráfico (últimos 30 dias ou período selecionado)
    const campaigns = await prisma.emailCampaign.findMany({
      where: {
        teamId: teamAccess.access.teamId,
        sentAt: { gte: from, lte: to },
        ...(campaignId && { id: campaignId }),
      },
      select: {
        id: true,
        name: true,
        sentAt: true,
        totalSent: true,
        totalDelivered: true,
        totalOpened: true,
        totalClicked: true,
        totalBounced: true,
        totalComplained: true,
      },
      orderBy: { sentAt: "desc" },
    })

    return NextResponse.json(
      new Output(true, [], [], {
        period: { from, to },
        totals: {
          sent: total,
          delivered,
          opened,
          clicked,
          bounced,
          complained,
        },
        rates: {
          deliverabilityRate: safe(delivered, total),
          openRate: safe(opened, delivered),
          clickRate: safe(clicked, delivered),
          bounceRate: safe(bounced, total),
          complainRate: safe(complained, total),
        },
        campaigns,
      }),
      { status: 200 }
    )
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[EmailAnalyticsRoute][GET]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
