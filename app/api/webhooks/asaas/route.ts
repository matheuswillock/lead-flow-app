// app/api/webhooks/asaas/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { PaymentRepository } from '@/app/api/infra/data/repositories/payment/PaymentRepository';
import { PaymentValidationService } from '@/app/api/services/PaymentValidation/PaymentValidationService';
import { PaymentValidationUseCase } from '@/app/api/useCases/payments/PaymentValidationUseCase';

export async function POST(request: NextRequest) {
  try {
    console.info('🎯 [Webhook Asaas] Requisição recebida');
    console.info('🔍 [Webhook Asaas] Headers:', Object.fromEntries(request.headers.entries()));
    console.info('🔍 [Webhook Asaas] URL:', request.url);
    console.info('🔍 [Webhook Asaas] Method:', request.method);
    
    // Verificar token de autenticação do Asaas (opcional mas recomendado)
    const asaasToken = request.headers.get('asaas-access-token');
    const expectedToken = process.env.ASAAS_WEBHOOK_TOKEN;

    console.info('🔑 [Webhook Asaas] Token recebido:', asaasToken ? 'presente' : 'ausente');
    console.info('🔑 [Webhook Asaas] Token esperado:', expectedToken ? 'configurado' : 'não configurado');

    // TEMPORÁRIO: Permitir sem token para debug
    if (expectedToken && asaasToken && asaasToken !== expectedToken) {
      console.warn('⚠️ [Webhook Asaas] Token inválido (mas permitindo para debug)');
      // return NextResponse.json(
      //   { error: 'Unauthorized' },
      //   { status: 401 }
      // );
    }

    const body = await request.json();

    console.info('📨 [Webhook Asaas] Evento recebido:', {
      event: body.event,
      paymentId: body.payment?.id,
      paymentStatus: body.payment?.status,
      subscriptionId: body.payment?.subscription,
      customer: body.payment?.customer,
    });

    // Log completo do evento para debug
    console.info('📋 [Webhook Asaas] Detalhes completos do evento:', JSON.stringify(body, null, 2));

    // Se não há payment (ex.: SUBSCRIPTION_CREATED), ainda processamos para vincular IDs
    const hasPayment = !!body.payment;

    // Ignorar se payment existe mas não tem ID
    if (hasPayment && !body.payment.id) {
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
      payment: hasPayment ? body.payment : body.subscription,
    });

    console.info('[Webhook Asaas] Resultado:', result);

    // Se o pagamento foi confirmado, notificar o frontend via endpoint público
    if (result.isPaid && body?.payment?.subscription) {
      const subscriptionId = body.payment.subscription;
      console.info('💾 [Webhook Asaas] Notificando frontend para subscriptionId:', subscriptionId);
      
      try {
        // Chamar endpoint de notificação (não bloqueia a resposta ao Asaas)
        const notifyUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/v1/subscriptions/${subscriptionId}/notify-payment`;
        
        fetch(notifyUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paymentId: body.payment.id,
            status: body.payment.status,
            timestamp: Date.now(),
          }),
        }).catch(error => {
          console.error('❌ [Webhook Asaas] Erro ao notificar frontend:', error);
        });
        
        console.info('✅ [Webhook Asaas] Notificação enviada para frontend');
      } catch (error) {
        console.error('❌ [Webhook Asaas] Erro ao processar notificação:', error);
      }
    }

    // Retornar 200 para o Asaas saber que processamos com sucesso
    return NextResponse.json(
      { success: true, message: 'Webhook processado', isPaid: result.isPaid },
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
