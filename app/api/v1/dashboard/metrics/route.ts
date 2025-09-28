import { NextRequest, NextResponse } from 'next/server';
import { metricsUseCase } from '@/app/api/useCases/metrics/MetricsUseCase';
import type { MetricsFilters } from '@/app/api/useCases/metrics/IMetricsUseCase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const managerId = searchParams.get('managerId');
    const period = searchParams.get('period') as '7d' | '30d' | '3m' | '6m' | '1y' || '30d';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const filters: MetricsFilters = {
      managerId: managerId || '',
      period,
      ...(startDate && { startDate: new Date(startDate) }),
      ...(endDate && { endDate: new Date(endDate) }),
    };

    const result = await metricsUseCase.getDashboardMetrics(filters);

    const statusCode = result.isValid ? 200 : 400;
    
    return NextResponse.json(result, { status: statusCode });

  } catch (error) {
    console.error('Erro inesperado na route de métricas:', error);
    
    const errorResult = {
      isValid: false,
      successMessages: [],
      errorMessages: ['Erro inesperado no servidor'],
      result: null
    };

    return NextResponse.json(errorResult, { status: 500 });
  }
}