import { NextRequest, NextResponse } from 'next/server';
import type { IMetricsUseCase, MetricsFilters } from '@/app/api/useCases/metrics/IMetricsUseCase';
import type { TeamContext } from '@/app/api/infra/data/repositories/metrics/IMetricsRepository';
import { IDashboardInfosService } from '@/app/api/services/DashboardInfos/IDashboardInfosService';
import { DashboardInfosService } from '@/app/api/services/DashboardInfos/DashboardInfosService';
import { MetricsUseCase } from '@/app/api/useCases/metrics/MetricsUseCase';
import { getTeamAccess } from '@/app/api/v1/utils/teamAccess';

const dashboardInfosService: IDashboardInfosService = new DashboardInfosService();
const metricsUseCase: IMetricsUseCase = new MetricsUseCase(dashboardInfosService);

export async function GET(request: NextRequest) {
  try {
    const teamAccess = await getTeamAccess(request);
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }

    const { access } = teamAccess;
    const ctx: TeamContext = { profileId: access.profileId, userTimezone: access.userTimezone, teamMember: access.teamMember };

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') as '7d' | '30d' | '3m' | '6m' | '1y' || '30d';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const filters: MetricsFilters = {
      supabaseId: access.supabaseId,
      teamId: access.teamId,
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
