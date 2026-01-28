import { NextRequest, NextResponse } from 'next/server';
import { metaLeadService } from '@/app/api/services/MetaLeadService';

/**
 * GET /api/v1/meta/forms/[formId]/leads?limit=100
 * 
 * Lista todos os leads de um formulário específico
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ formId: string }> }
) {
  try {
    const { formId } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');

    console.info(`📊 Buscando leads do formulário ${formId}...`);

    const leads = await metaLeadService.getFormLeads(formId, limit);

    return NextResponse.json(
      {
        isValid: true,
        successMessages: [`${leads.length} lead(s) encontrado(s)`],
        errorMessages: [],
        result: {
          formId,
          totalLeads: leads.length,
          leads
        }
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('❌ Erro ao buscar leads:', error);

    return NextResponse.json(
      {
        isValid: false,
        errorMessages: [error instanceof Error ? error.message : 'Erro ao buscar leads'],
        successMessages: [],
        result: null
      },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';
