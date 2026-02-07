import { NextRequest, NextResponse } from 'next/server';
import { metaLeadService } from '@/app/api/services/MetaLeadService';
import { metaLeadIntegrationRepository } from '@/app/api/infra/data/repositories/integrations/MetaLeadIntegrationRepository';
import { RegisterNewUserProfile } from '@/app/api/useCases/profiles/ProfileUseCase';
import { decryptToken } from '@/lib/integrations-crypto';

/**
 * GET /api/v1/meta/forms?pageId=123456789
 * 
 * Lista todos os formulários de uma página do Facebook
 */
export async function GET(request: NextRequest) {
  try {
    const supabaseId = request.headers.get('x-supabase-user-id');
    if (!supabaseId) {
      return NextResponse.json(
        {
          isValid: false,
          errorMessages: ['ID do usuário é obrigatório'],
          successMessages: [],
          result: null
        },
        { status: 401 }
      );
    }

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

    const profileUseCase = new RegisterNewUserProfile();
    const profileInfo = await profileUseCase.getProfileInfoBySupabaseId(supabaseId);
    if (!profileInfo) {
      return NextResponse.json(
        {
          isValid: false,
          errorMessages: ['Perfil não encontrado'],
          successMessages: [],
          result: null
        },
        { status: 404 }
      );
    }

    const managerId = profileInfo.isMaster ? profileInfo.id : profileInfo.managerId;
    if (!managerId) {
      return NextResponse.json(
        {
          isValid: false,
          errorMessages: ['Manager não identificado'],
          successMessages: [],
          result: null
        },
        { status: 400 }
      );
    }

    const integration = await metaLeadIntegrationRepository.findByPageId(pageId);
    if (!integration || integration.managerId !== managerId) {
      return NextResponse.json(
        {
          isValid: false,
          errorMessages: ['Integração Meta não encontrada para esta página'],
          successMessages: [],
          result: null
        },
        { status: 404 }
      );
    }

    if (!integration.isActive) {
      return NextResponse.json(
        {
          isValid: false,
          errorMessages: ['Integração Meta está desativada'],
          successMessages: [],
          result: null
        },
        { status: 403 }
      );
    }

    console.info(`📋 Listando formulários da página ${pageId}...`);

    const accessToken = decryptToken(integration.pageAccessTokenEnc);
    const forms = await metaLeadService.getLeadgenForms(pageId, accessToken);

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
