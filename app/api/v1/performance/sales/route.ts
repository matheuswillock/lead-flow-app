import { NextRequest, NextResponse } from 'next/server';
import { Output } from '@/lib/output';
import { getTeamAccess } from '@/app/api/v1/utils/teamAccess';
import { isManagerLikeRole } from '@/lib/roles';
import { performanceSalesRequestSchema } from './DTO/performanceSalesRequestDTO';
import { performanceUseCase, PerformanceUseCase } from '@/app/api/useCases/performance/PerformanceUseCase';
import { endOfDayInTz, parseDateKeyToUtc } from '@/lib/dates';

export async function GET(request: NextRequest) {
  console.info('[PerformanceSalesRoute][GET] Received request');

  const teamAccess = await getTeamAccess(request);
  if (teamAccess.error) {
    return NextResponse.json(teamAccess.error, { status: teamAccess.status });
  }

  const { profileId, teamId, teamMember, userTimezone } = teamAccess.access;
  const isManager = isManagerLikeRole(teamMember.role);
  const isCloser = teamMember.functions.includes('CLOSER');
  const isSdr = teamMember.functions.includes('SDR');

  if (!isManager && !isCloser && !isSdr) {
    return NextResponse.json(
      new Output(false, [], ['Acesso negado: somente managers, closers ou SDRs podem acessar este recurso'], null),
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const rawParams = Object.fromEntries(searchParams.entries());

  const parsed = performanceSalesRequestSchema.safeParse(rawParams);
  if (!parsed.success) {
    return NextResponse.json(
      new Output(false, [], [parsed.error.issues[0]?.message ?? 'Parâmetros inválidos'], null),
      { status: 400 }
    );
  }

  const { preset, startDate, endDate, sdrId, closerId, search, page, pageSize } = parsed.data;

  let resolvedStartDate: Date;
  let resolvedEndDate: Date;

  if (startDate && endDate) {
    resolvedStartDate = parseDateKeyToUtc(startDate, userTimezone);
    resolvedEndDate = endOfDayInTz(parseDateKeyToUtc(endDate, userTimezone), userTimezone);
  } else {
    const dates = PerformanceUseCase.resolvePresetToDates(preset ?? '1m', userTimezone);
    resolvedStartDate = dates.startDate;
    resolvedEndDate = dates.endDate;
  }

  const resolvedCloserId = isCloser && !isManager ? profileId : closerId;
  const resolvedSdrId = isSdr && !isManager ? profileId : sdrId;

  const result = await performanceUseCase.getSalesPerformance({
    teamId,
    profileId,
    isManager,
    isCloser,
    isSdr,
    startDate: resolvedStartDate,
    endDate: resolvedEndDate,
    sdrId: resolvedSdrId,
    closerId: resolvedCloserId,
    search,
    page,
    pageSize,
  });

  return NextResponse.json(result, { status: result.isValid ? 200 : 500 });
}
