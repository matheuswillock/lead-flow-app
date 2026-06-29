import { NextRequest, NextResponse } from "next/server"
import { Output } from "@/lib/output"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { preScheduleSlotUseCase } from "@/app/api/useCases/preSchedule/PreScheduleSlotUseCase"

/**
 * GET /api/v1/teams/[teamId]/pre-schedule-slots?date=YYYY-MM-DD
 * Returns occupied 30-min slots for transfer leads on a given day.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const teamAccess = await getTeamAccess(request)
    if ("error" in teamAccess) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status })
    }

    const { teamId: accessTeamId } = teamAccess.access
    const { teamId } = await params

    if (teamId !== accessTeamId) {
      const output = new Output(false, [], ["Acesso negado a este time."], null)
      return NextResponse.json(output, { status: 403 })
    }

    const dateParam = request.nextUrl.searchParams.get("date")
    const excludeLeadId = request.nextUrl.searchParams.get("excludeLeadId")
    if (!dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      const output = new Output(false, [], ["Parâmetro date inválido. Use formato YYYY-MM-DD."], null)
      return NextResponse.json(output, { status: 400 })
    }

    const result = await preScheduleSlotUseCase.getSlots({
      teamId,
      dateParam,
      excludeLeadId: excludeLeadId ?? undefined,
    })

    return NextResponse.json(result, { status: result.isValid ? 200 : 500 })
  } catch (error) {
    console.error("[PreScheduleSlotsRoute][GET] Erro:", error)
    const output = new Output(false, [], ["Erro interno do servidor."], null)
    return NextResponse.json(output, { status: 500 })
  }
}
