import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { prisma } from "@/app/api/infra/data/prisma"
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';

export async function GET(request: NextRequest, { params }: { params: Promise<{ logId: string }> }) {
  try {
    const { logId } = await params
    const teamAccess = await getTeamAccess(request)
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status })
    }

    const log = await prisma.emailLog.findFirst({
      where: { id: logId, teamId: teamAccess.access.teamId },
      include: {
        campaign: { select: { id: true, name: true } },
        events: {
          orderBy: { occurredAt: "asc" },
          select: {
            id: true,
            type: true,
            occurredAt: true,
            metadata: true,
          },
        },
      },
    })

    if (!log) {
      return NextResponse.json(new Output(false, [], ["Log de email não encontrado"], null), { status: 404 })
    }

    return NextResponse.json(new Output(true, [], [], log), { status: 200 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[EmailLogByIdRoute][GET]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
