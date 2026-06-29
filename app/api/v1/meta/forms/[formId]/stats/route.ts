import { NextRequest, NextResponse } from 'next/server';
import { metaLeadService } from '@/app/api/services/MetaLeadService';
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';

/**
 * GET /api/v1/meta/forms/[formId]/stats
 * 
 * Busca estatísticas completas de um formulário
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ formId: string }> }
) {
  try {
    const { formId } = await params;

    console.info(`📈 Buscando estatísticas do formulário ${formId}...`);

    const stats = await metaLeadService.getFormStats(formId);

    return NextResponse.json(
      {
        isValid: true,
        successMessages: ['Estatísticas obtidas com sucesso'],
        errorMessages: [],
        result: stats
      },
      { status: 200 }
    );

  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error('❌ Erro ao buscar estatísticas:', error);

    return NextResponse.json(
      {
        isValid: false,
        errorMessages: [error instanceof Error ? error.message : 'Erro ao buscar estatísticas'],
        successMessages: [],
        result: null
      },
      { status: 500 }
    );
  }
}

