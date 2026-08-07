import { NextRequest, NextResponse, connection } from "next/server";
import { Output } from '@/lib/output';
import { getTeamAccess } from '@/app/api/v1/utils/teamAccess';
import { canAccessPerformanceManagerView } from '@/app/api/v1/performance/utils/canAccessPerformanceManagerView';
import { performanceMeetingsHeldRequestSchema } from './DTO/performanceMeetingsHeldRequestDTO';
import { performanceMeetingsHeldUseCase } from '@/app/api/useCases/performance/PerformanceMeetingsHeldUseCase';
import { endOfDayInTz, parseDateKeyToUtc } from '@/lib/dates';

export async function GET(request: NextRequest) {
  await connection();

  console.info('[PerformanceMeetingsHeldRoute][GET] Received request');

  const teamAccess = await getTeamAccess(request);
  if (teamAccess.error) {
    return NextResponse.json(teamAccess.error, { status: teamAccess.status });
  }

  if (!canAccessPerformanceManagerView(teamAccess.access)) {
    return NextResponse.json(
      new Output(false, [], ['Acesso negado: somente managers ou master da conta podem acessar este recurso'], null),
      { status: 403 }
    );
  }

  const { teamId, userTimezone } = teamAccess.access;
  const { searchParams } = new URL(request.url);
  const parsed = performanceMeetingsHeldRequestSchema.safeParse(Object.fromEntries(searchParams.entries()));

  if (!parsed.success) {
    return NextResponse.json(
      new Output(false, [], [parsed.error.issues[0]?.message ?? 'Parâmetros inválidos'], null),
      { status: 400 }
    );
  }

  const { startDate, endDate, sdrId, closerId, countMonth, page, pageSize } = parsed.data;

  const result = await performanceMeetingsHeldUseCase.getMeetingsHeld({
    teamId,
    startDate: parseDateKeyToUtc(startDate, userTimezone),
    endDate: endOfDayInTz(parseDateKeyToUtc(endDate, userTimezone), userTimezone),
    sdrId,
    closerId,
    countMonth,
    page,
    pageSize,
    userTimezone,
  });

  return NextResponse.json(result, { status: result.isValid ? 200 : 500 });
}
