import { NextRequest, NextResponse } from 'next/server';
import { metaLeadService } from '@/app/api/services/MetaLeadService';

/**
 * GET /api/v1/meta/forms/[formId]/stats
 * 
 * Busca estatísticas completas de um formulário
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { formId: string } }
) {
  try {
    const { formId } = params;

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

export const dynamic = 'force-dynamic';
