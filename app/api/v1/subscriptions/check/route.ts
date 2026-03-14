import { NextRequest, NextResponse } from 'next/server';
import { SubscriptionRepository } from '@/app/api/infra/data/repositories/subscription/SubscriptionRepository';
import { SubscriptionCheckService } from '@/app/api/services/SubscriptionCheck/SubscriptionCheckService';
import { CheckSubscriptionUseCase } from '@/app/api/useCases/subscriptions/CheckSubscriptionUseCase';
import { Output } from '@/lib/output';

/**
 * POST /api/v1/subscriptions/check
 * Verifica se um usuário já possui assinatura ativa
 * Body: { email, cpfCnpj, phone }
 */
export async function POST(request: NextRequest) {
  const routeName = '[SubscriptionCheckRoute][POST]';

  try {
    const body = await request.json();

    console.info(`${routeName} Request received`);

    const subscriptionRepository = new SubscriptionRepository();
    const subscriptionCheckService = new SubscriptionCheckService(subscriptionRepository);
    const checkSubscriptionUseCase = new CheckSubscriptionUseCase(subscriptionCheckService);

    const output = await checkSubscriptionUseCase.execute(body);
    const result = output.result as
      | { hasActiveSubscription?: boolean; userExists?: boolean }
      | null;
    const statusCode = output.isValid ? 200 : 400;

    console.info(`${routeName} Completed`, {
      isValid: output.isValid,
      hasActiveSubscription: result?.hasActiveSubscription ?? false,
      userExists: result?.userExists ?? false,
      errorMessages: output.errorMessages,
    });

    return NextResponse.json(output, { status: statusCode });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Erro ao verificar assinatura';

    console.error(`${routeName} Unexpected error`, error);

    return NextResponse.json(
      new Output(false, [], [message], null),
      { status: 500 }
    );
  }
}

