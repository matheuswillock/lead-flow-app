// app/api/v1/profiles/permanent-subscription/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { togglePermanentSubscriptionUseCase } from '@/app/api/useCases/profiles/TogglePermanentSubscriptionUseCase';
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';

/**
 * POST /api/v1/profiles/permanent-subscription
 * Torna um profile vitalício (bypass de validação Asaas)
 * 
 * Body: 
 * {
 *   "profileId": "uuid-do-profile",
 *   "enable": true
 * }
 * 
 * Exemplo Postman:
 * POST https://www.corretorstudio.com.br/api/v1/profiles/permanent-subscription
 * Body: { "profileId": "a1b2c3...", "enable": true }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { profileId, enable } = body;

    console.info('📞 [POST /api/v1/profiles/permanent-subscription] Requisição recebida:', {
      profileId,
      enable
    });

    // Validações
    if (!profileId) {
      const errorResult = {
        isValid: false,
        successMessages: [],
        errorMessages: ['Campo "profileId" é obrigatório'],
        result: null
      };
      return NextResponse.json(errorResult, { status: 400 });
    }

    if (typeof enable !== 'boolean') {
      const errorResult = {
        isValid: false,
        successMessages: [],
        errorMessages: ['Campo "enable" deve ser boolean (true/false)'],
        result: null
      };
      return NextResponse.json(errorResult, { status: 400 });
    }

    // Chamar UseCase
    const result = await togglePermanentSubscriptionUseCase.togglePermanentSubscription(
      profileId,
      enable
    );

    const statusCode = result.isValid ? 200 : 400;

    console.info(`📤 [POST /api/v1/profiles/permanent-subscription] Resposta: ${statusCode}`, {
      isValid: result.isValid
    });

    return NextResponse.json(result, { status: statusCode });

  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error('❌ [POST /api/v1/profiles/permanent-subscription] Erro inesperado:', error);
    
    const errorResult = {
      isValid: false,
      successMessages: [],
      errorMessages: ['Erro inesperado no servidor'],
      result: null
    };

    return NextResponse.json(errorResult, { status: 500 });
  }
}
