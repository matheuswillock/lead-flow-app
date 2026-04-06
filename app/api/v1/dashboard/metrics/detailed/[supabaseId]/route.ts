import { IDashboardInfosService } from '@/app/api/services';
import { DashboardInfosService } from '@/app/api/services/DashboardInfos/DashboardInfosService';
import type { TeamContext } from '@/app/api/infra/data/repositories/metrics/IMetricsRepository';
import { IMetricsUseCase } from '@/app/api/useCases';
import { MetricsUseCase } from '@/app/api/useCases/metrics/MetricsUseCase';
import { NextRequest, NextResponse } from 'next/server';
import { getTeamAccess } from '@/app/api/v1/utils/teamAccess';

const dashboardInfosService: IDashboardInfosService = new DashboardInfosService();
const metricsUseCase: IMetricsUseCase = new MetricsUseCase(dashboardInfosService);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ supabaseId: string }> }
) {
  try {
    const { supabaseId: _supabaseId } = await params;
    const teamAccess = await getTeamAccess(request);
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }

    const { access } = teamAccess;
    const ctx: TeamContext = { profileId: access.profileId, teamMember: access.teamMember };

    const result = await metricsUseCase.getDetailedStatusMetrics(
      access.supabaseId,
      access.teamId,
      ctx
    );

    return NextResponse.json(result, { status: result.isValid ? 200 : 400 });

  } catch (error) {
    console.error('[DashboardMetricsDetailedRoute][GET] Erro inesperado:', error);
    return NextResponse.json(
      { isValid: false, successMessages: [], errorMessages: ['Erro inesperado no servidor'], result: null },
      { status: 500 }
    );
  }
}
