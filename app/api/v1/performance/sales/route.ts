import { NextRequest, NextResponse } from 'next/server';
import { Output } from '@/lib/output';
import { getTeamAccess } from '@/app/api/v1/utils/teamAccess';
import { isManagerLikeRole } from '@/lib/roles';
import { performanceSalesRequestSchema } from './DTO/performanceSalesRequestDTO';
import { performanceUseCase, PerformanceUseCase } from '@/app/api/useCases/performance/PerformanceUseCase';

export async function GET(request: NextRequest) {
  console.info('[PerformanceSalesRoute][GET] Received request');

  const teamAccess = await getTeamAccess(request);
  if (teamAccess.error) {
    return NextResponse.json(teamAccess.error, { status: teamAccess.status });
  }

  const { profileId, teamId, teamMember } = teamAccess.access;
  const isManager = isManagerLikeRole(teamMember.role);
  const isCloser = teamMember.functions.includes('CLOSER');

  if (!isManager && !isCloser) {
    return NextResponse.json(
      new Output(false, [], ['Acesso negado: somente managers ou closers podem acessar este recurso'], null),
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
    resolvedStartDate = new Date(startDate);
    resolvedEndDate = new Date(endDate);
    resolvedEndDate.setHours(23, 59, 59, 999);
  } else {
    const dates = PerformanceUseCase.resolvePresetToDates(preset ?? '1m');
    resolvedStartDate = dates.startDate;
    resolvedEndDate = dates.endDate;
  }

  // CLOSER restriction: cannot override their own scope via query param
  const resolvedCloserId = isCloser && !isManager ? profileId : closerId;

  const result = await performanceUseCase.getSalesPerformance({
    teamId,
    profileId,
    isManager,
    isCloser,
    startDate: resolvedStartDate,
    endDate: resolvedEndDate,
    sdrId,
    closerId: resolvedCloserId,
    search,
    page,
    pageSize,
  });

  return NextResponse.json(result, { status: result.isValid ? 200 : 500 });
}
