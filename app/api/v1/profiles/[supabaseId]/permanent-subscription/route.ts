import { NextRequest, NextResponse } from 'next/server';
import { UpdatePermanentSubscriptionUseCase } from '@/app/api/useCases/profiles/UpdatePermanentSubscriptionUseCase';
import { profileRepository } from '@/app/api/infra/data/repositories/profile/ProfileRepository';
import { createSupabaseServer } from '@/lib/supabase/server';

/**
 * PUT /api/v1/profiles/[supabaseId]/permanent-subscription
 * Atualiza a flag de assinatura permanente de um perfil
 * Apenas usuários master podem fazer essa operação
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ supabaseId: string }> }
) {
  try {
    const { supabaseId: id } = await params;
    // 1. Verificar autenticação
    const supabase = await createSupabaseServer();
    
    if (!supabase) {
      return NextResponse.json(
        {
          isValid: false,
          successMessages: [],
          errorMessages: ['Erro ao criar cliente Supabase'],
          result: null
        },
        { status: 500 }
      );
    }
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          isValid: false,
          successMessages: [],
          errorMessages: ['Usuário não autenticado'],
          result: null
        },
        { status: 401 }
      );
    }

    // 2. Buscar perfil do usuário autenticado
    const requestingUser = await profileRepository.findBySupabaseId(user.id);
    
    if (!requestingUser) {
      return NextResponse.json(
        {
          isValid: false,
          successMessages: [],
          errorMessages: ['Perfil do usuário não encontrado'],
          result: null
        },
        { status: 404 }
      );
    }

    // 3. Parse body
    const body = await request.json();
    const { hasPermanentSubscription } = body;

    if (typeof hasPermanentSubscription !== 'boolean') {
      return NextResponse.json(
        {
          isValid: false,
          successMessages: [],
          errorMessages: ['Campo hasPermanentSubscription deve ser um boolean'],
          result: null
        },
        { status: 400 }
      );
    }

    // 4. Executar UseCase
    const useCase = new UpdatePermanentSubscriptionUseCase(profileRepository);
    const result = await useCase.updatePermanentSubscription(
      id,
      hasPermanentSubscription,
      requestingUser.id
    );

    // 5. Retornar resultado
    const statusCode = result.isValid ? 200 : 400;
    return NextResponse.json(result, { status: statusCode });

  } catch (error) {
    console.error('❌ [PUT /api/v1/profiles/[supabaseId]/permanent-subscription] Erro:', error);
    
    return NextResponse.json(
      {
        isValid: false,
        successMessages: [],
        errorMessages: ['Erro interno do servidor'],
        result: null
      },
      { status: 500 }
    );
  }
}
