import { NextRequest, NextResponse } from "next/server";
import { Output } from "@/lib/output";
import { prisma } from "@/app/api/infra/data/prisma";
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess";
import { LeadStatus } from "@prisma/client";

/**
 * GET /api/v1/teams/[teamId]/pre-schedule-slots?date=YYYY-MM-DD
 * Returns occupied 30-min slots for transfer leads on a given day.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const teamAccess = await getTeamAccess(request);
    if ("error" in teamAccess) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }

    const { teamId: accessTeamId } = teamAccess.access;
    const { teamId } = await params;

    if (teamId !== accessTeamId) {
      const output = new Output(false, [], ["Acesso negado a este time."], null);
      return NextResponse.json(output, { status: 403 });
    }

    const dateParam = request.nextUrl.searchParams.get("date");
    if (!dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      const output = new Output(false, [], ["Parâmetro date inválido. Use formato YYYY-MM-DD."], null);
      return NextResponse.json(output, { status: 400 });
    }

    const startOfDay = new Date(`${dateParam}T00:00:00.000Z`);
    const endOfDay = new Date(`${dateParam}T23:59:59.999Z`);

    const leads = await prisma.lead.findMany({
      where: {
        teamId,
        isTransfer: true,
        closerId: null,
        meetingDate: { gte: startOfDay, lt: endOfDay },
        status: {
          notIn: [
            LeadStatus.opportunityLost,
            LeadStatus.disqualified,
            LeadStatus.operator_denied,
            LeadStatus.contract_finalized,
          ],
        },
      },
      select: { meetingDate: true },
    });

    const occupiedSlots = leads
      .map((lead) => {
        if (!lead.meetingDate) return null;
        const d = lead.meetingDate;
        return d.getUTCHours() * 60 + Math.floor(d.getUTCMinutes() / 30) * 30;
      })
      .filter((slot): slot is number => slot !== null);

    const output = new Output(true, [], [], { occupiedSlots });
    return NextResponse.json(output, { status: 200 });
  } catch (error) {
    console.error("[PreScheduleSlotsRoute][GET] Erro:", error);
    const output = new Output(false, [], ["Erro interno do servidor."], null);
    return NextResponse.json(output, { status: 500 });
  }
}
