import { NextRequest, NextResponse } from 'next/server';
import { metaLeadService } from '@/app/api/services/MetaLeadService';

/**
 * GET /api/v1/meta/forms?pageId=123456789
 * 
 * Lista todos os formulários de uma página do Facebook
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pageId = searchParams.get('pageId');

    if (!pageId) {
      return NextResponse.json(
        { 
          isValid: false,
          errorMessages: ['pageId é obrigatório'],
          successMessages: [],
          result: null
        },
        { status: 400 }
      );
    }

    console.info(`📋 Listando formulários da página ${pageId}...`);

    const forms = await metaLeadService.getLeadgenForms(pageId);

    return NextResponse.json(
      {
        isValid: true,
        successMessages: [`${forms.length} formulário(s) encontrado(s)`],
        errorMessages: [],
        result: forms
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('❌ Erro ao listar formulários:', error);

    return NextResponse.json(
      {
        isValid: false,
        errorMessages: [error instanceof Error ? error.message : 'Erro ao listar formulários'],
        successMessages: [],
        result: null
      },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';
