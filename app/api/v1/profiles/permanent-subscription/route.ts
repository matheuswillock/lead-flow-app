// app/api/v1/profiles/permanent-subscription/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { togglePermanentSubscriptionUseCase } from '@/app/api/useCases/profiles/TogglePermanentSubscriptionUseCase';

/**
 * POST /api/v1/profiles/permanent-subscription
 * Ativa ou desativa assinatura permanente/vitalícia de um profile.
 * Ao ativar, cria assinatura R$0,00 no Asaas com o período determinado.
 *
 * Body:
 * {
 *   "profileId": "uuid-do-profile",
 *   "enable": true,
 *   "startDate": "2026-04-01",   // opcional – default: hoje
 *   "endDate": "2027-04-01"      // opcional – default: +1 ano
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { profileId, enable, startDate, endDate } = body;

    console.info('[POST /api/v1/profiles/permanent-subscription] Requisição recebida:', {
      profileId,
      enable,
      startDate,
      endDate,
    });

    if (!profileId) {
      return NextResponse.json(
        { isValid: false, successMessages: [], errorMessages: ['Campo "profileId" é obrigatório'], result: null },
        { status: 400 }
      );
    }

    if (typeof enable !== 'boolean') {
      return NextResponse.json(
        { isValid: false, successMessages: [], errorMessages: ['Campo "enable" deve ser boolean (true/false)'], result: null },
        { status: 400 }
      );
    }

    const result = await togglePermanentSubscriptionUseCase.togglePermanentSubscription(
      profileId,
      enable,
      enable ? { startDate, endDate } : undefined
    );

    const statusCode = result.isValid ? 200 : 400;

    console.info(`[POST /api/v1/profiles/permanent-subscription] Resposta: ${statusCode}`, {
      isValid: result.isValid,
    });

    return NextResponse.json(result, { status: statusCode });
  } catch (error) {
    console.error('[POST /api/v1/profiles/permanent-subscription] Erro inesperado:', error);
    return NextResponse.json(
      { isValid: false, successMessages: [], errorMessages: ['Erro inesperado no servidor'], result: null },
      { status: 500 }
    );
  }
}
