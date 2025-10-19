import { NextRequest, NextResponse } from 'next/server';
import { SubscriptionRepository } from '@/app/api/infra/data/repositories/subscription/SubscriptionRepository';
import { SubscriptionCheckService } from '@/app/api/services/SubscriptionCheck/SubscriptionCheckService';
import { CheckSubscriptionUseCase } from '@/app/api/useCases/subscriptions/CheckSubscriptionUseCase';

/**
 * POST /api/v1/subscriptions/check
 * Verifica se um usuário já possui assinatura ativa
 * Body: { email, cpfCnpj, phone }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    console.info('🎯 [Controller] POST /api/v1/subscriptions/check');

    // Dependency Injection
    const subscriptionRepository = new SubscriptionRepository();
    const subscriptionCheckService = new SubscriptionCheckService(subscriptionRepository);
    const checkSubscriptionUseCase = new CheckSubscriptionUseCase(subscriptionCheckService);

    // Executar use case
    const result = await checkSubscriptionUseCase.execute(body);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('❌ [Controller] Erro:', error.message);

    // Erro de validação
    if (error.message.includes('campo de identificação')) {
      return NextResponse.json(
        {
          success: false,
          message: error.message,
        },
        { status: 400 }
      );
    }

    // Erro interno
    return NextResponse.json(
      {
        success: false,
        message: 'Erro ao verificar assinatura',
        error: error.message,
      },
      { status: 500 }
    );
  }
}

