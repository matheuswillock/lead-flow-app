import { NextRequest, NextResponse } from 'next/server';
import type { MetricsFilters } from '@/app/api/useCases/metrics/IMetricsUseCase';
import type { TeamContext } from '@/app/api/infra/data/repositories/metrics/IMetricsRepository';
import { metricsUseCase } from '@/app/api/useCases/metrics/MetricsUseCase';
import { getTeamAccess } from '@/app/api/v1/utils/teamAccess';
import {
  getDashboardTeamScopeFromRequest,
  resolveDashboardTeamScope,
} from '@/app/api/v1/utils/dashboardTeamScope';

export async function GET(request: NextRequest) {
  try {
    const teamAccess = await getTeamAccess(request);
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }

    const { access } = teamAccess;
    const teamScope = getDashboardTeamScopeFromRequest(request);
    const scopeResult = await resolveDashboardTeamScope(access, teamScope);
    if ("error" in scopeResult) {
      return NextResponse.json(scopeResult.error, { status: scopeResult.status });
    }

    const ctx: TeamContext = {
      profileId: access.profileId,
      userTimezone: access.userTimezone,
      teamMember: access.teamMember,
    };

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') as '7d' | '30d' | '3m' | '6m' | '1y' || '30d';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const filters: MetricsFilters = {
      supabaseId: access.supabaseId,
      teamId: access.teamId,
      teamIds: scopeResult.teamIds,
      teamScope: scopeResult.teamScope,
      masterId: scopeResult.masterId,
      period,
      ...(startDate && { startDate: new Date(startDate) }),
      ...(endDate && { endDate: new Date(endDate) }),
    };

    const result = await metricsUseCase.getDashboardMetrics(filters, ctx);

    return NextResponse.json(result, { status: result.isValid ? 200 : 400 });

  } catch (error) {
    console.error('[DashboardMetricsRoute][GET] Erro inesperado:', error);
    return NextResponse.json(
      { isValid: false, successMessages: [], errorMessages: ['Erro inesperado no servidor'], result: null },
      { status: 500 }
    );
  }
}
