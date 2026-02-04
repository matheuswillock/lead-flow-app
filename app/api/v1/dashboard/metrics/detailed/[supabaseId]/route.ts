import { IDashboardInfosService } from '@/app/api/services';
import { DashboardInfosService } from '@/app/api/services/DashboardInfos/DashboardInfosService';
import { IMetricsUseCase } from '@/app/api/useCases';
import { MetricsUseCase } from '@/app/api/useCases/metrics/MetricsUseCase';
import { NextRequest, NextResponse } from 'next/server';
import { getTeamAccess } from '@/app/api/v1/utils/teamAccess';

const dashboardInfosService : IDashboardInfosService = new DashboardInfosService();
const metricsUseCase : IMetricsUseCase = new MetricsUseCase(dashboardInfosService);

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

    const result = await metricsUseCase.getDetailedStatusMetrics(
      teamAccess.access.supabaseId,
      teamAccess.access.teamId
    );

    const statusCode = result.isValid ? 200 : 400;
    
    return NextResponse.json(result, { status: statusCode });

  } catch (error) {
    console.error('Erro inesperado na route de métricas detalhadas:', error);
    
    const errorResult = {
      isValid: false,
      successMessages: [],
      errorMessages: ['Erro inesperado no servidor'],
      result: null
    };

    return NextResponse.json(errorResult, { status: 500 });
  }
}
