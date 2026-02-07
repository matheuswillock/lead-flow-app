import { NextRequest, NextResponse } from 'next/server';
import { metaLeadService } from '@/app/api/services/MetaLeadService';
import { metaLeadIntegrationRepository } from '@/app/api/infra/data/repositories/integrations/MetaLeadIntegrationRepository';
import { RegisterNewUserProfile } from '@/app/api/useCases/profiles/ProfileUseCase';
import { decryptToken } from '@/lib/integrations-crypto';

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

    const { formId } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');
    const pageId = searchParams.get('pageId');

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

    const integration = pageId
      ? await metaLeadIntegrationRepository.findByPageId(pageId)
      : await metaLeadIntegrationRepository.findActiveByManagerId(managerId);

    if (!integration || integration.managerId !== managerId) {
      return NextResponse.json(
        {
          isValid: false,
          errorMessages: ['Integração Meta não encontrada'],
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

    console.info(`📊 Buscando leads do formulário ${formId}...`);

    const accessToken = decryptToken(integration.pageAccessTokenEnc);
    const leads = await metaLeadService.getFormLeads(formId, accessToken, limit);

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
