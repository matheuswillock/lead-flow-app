import { NextRequest, NextResponse } from 'next/server';
import { metricsUseCase } from '@/app/api/useCases/metrics/MetricsUseCase';

export async function GET(
  request: NextRequest,
  { params }: { params: { managerId: string } }
) {
  try {
    const { managerId } = params;

    const result = await metricsUseCase.getDetailedStatusMetrics(managerId);

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