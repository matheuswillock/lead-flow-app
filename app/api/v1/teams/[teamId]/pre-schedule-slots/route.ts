import { NextRequest, NextResponse } from "next/server";
import { Output } from "@/lib/output";
import { prisma } from "@/app/api/infra/data/prisma";
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess";
import { LeadStatus } from "@prisma/client";
import { DEFAULT_TZ, getDayRangeInTz, getMinutesInTz, resolveTimezone } from "@/lib/dates";

const SLOT_MINUTES = 30;

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
    const excludeLeadId = request.nextUrl.searchParams.get("excludeLeadId");
    if (!dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      const output = new Output(false, [], ["Parâmetro date inválido. Use formato YYYY-MM-DD."], null);
      return NextResponse.json(output, { status: 400 });
    }

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { master: { select: { timezone: true } } },
    });
    const timezone = resolveTimezone(team?.master?.timezone) || DEFAULT_TZ;
    const { start: startOfDay, end: endOfDay } = getDayRangeInTz(dateParam, timezone);

    const leads = await prisma.lead.findMany({
      where: {
        teamId,
        isTransfer: true,
        ...(excludeLeadId ? { id: { not: excludeLeadId } } : {}),
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
        return Math.floor(getMinutesInTz(lead.meetingDate, timezone) / SLOT_MINUTES) * SLOT_MINUTES;
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
