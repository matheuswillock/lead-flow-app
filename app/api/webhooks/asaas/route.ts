// app/api/webhooks/asaas/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { PaymentRepository } from '@/app/api/infra/data/repositories/payment/PaymentRepository';
import { PaymentValidationService } from '@/app/api/services/PaymentValidation/PaymentValidationService';
import { PaymentValidationUseCase } from '@/app/api/useCases/payments/PaymentValidationUseCase';

export async function POST(request: NextRequest) {
  try {
    // Verificar token de autenticação do Asaas (opcional mas recomendado)
    const asaasToken = request.headers.get('asaas-access-token');
    const expectedToken = process.env.ASAAS_WEBHOOK_TOKEN;

    if (expectedToken && asaasToken !== expectedToken) {
      console.warn('[Webhook Asaas] Token inválido');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();

    console.info('[Webhook Asaas] Evento recebido:', {
      event: body.event,
      paymentId: body.payment?.id,
      paymentStatus: body.payment?.status,
    });

    // Ignorar eventos que não têm payment (como SUBSCRIPTION_CREATED)
    if (!body.payment) {
      console.info('[Webhook Asaas] Evento sem payment - ignorando:', body.event);
      return NextResponse.json(
        { success: true, message: 'Evento sem payment - ignorado' },
        { status: 200 }
      );
    }

    // Ignorar se não tiver o campo obrigatório 'id' no payment
    if (!body.payment.id) {
      console.warn('[Webhook Asaas] Payment sem ID - ignorando');
      return NextResponse.json(
        { success: true, message: 'Payment sem ID - ignorado' },
        { status: 200 }
      );
    }

    // Dependency Injection
    const paymentRepository = new PaymentRepository();
    const paymentValidationService = new PaymentValidationService(
      paymentRepository
    );
    const paymentValidationUseCase = new PaymentValidationUseCase(
      paymentValidationService
    );

    // Process webhook
    const result = await paymentValidationUseCase.processWebhook({
      event: body.event,
      payment: body.payment,
    });

    console.info('[Webhook Asaas] Resultado:', result);

    // Retornar 200 para o Asaas saber que processamos com sucesso
    return NextResponse.json(
      { success: true, message: 'Webhook processado' },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[Webhook Asaas] Erro:', error);
    
    // Mesmo em caso de erro, retornar 200 para não pausar a fila do Asaas
    // Log do erro deve ser suficiente para investigação
    return NextResponse.json(
      { success: false, message: 'Erro processado' },
      { status: 200 }
    );
  }
}
