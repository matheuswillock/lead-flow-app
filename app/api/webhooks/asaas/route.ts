// app/api/webhooks/asaas/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { PaymentRepository } from '@/app/api/infra/data/repositories/payment/PaymentRepository';
import type { PaymentValidationResult } from '@/app/api/services/PaymentValidation/IPaymentValidationService';
import { PaymentValidationService } from '@/app/api/services/PaymentValidation/PaymentValidationService';
import { PaymentValidationUseCase } from '@/app/api/useCases/payments/PaymentValidationUseCase';
import { getFullUrl } from '@/lib/utils/app-url';

export async function POST(request: NextRequest) {
  try {
    console.info('🎯 [Webhook Asaas] ============================================');
    console.info('🎯 [Webhook Asaas] Requisição recebida');
    console.info('🔍 [Webhook Asaas] URL:', request.url);
    console.info('🔍 [Webhook Asaas] Method:', request.method);
    console.info('🔍 [Webhook Asaas] Headers (full):', JSON.stringify(Object.fromEntries(request.headers.entries()), null, 2));
    
    // Verificar token de autenticação do Asaas
    const asaasToken = request.headers.get('asaas-access-token');
    const expectedToken = process.env.ASAAS_WEBHOOK_TOKEN;
    
    console.info('🔐 [Webhook Asaas] ============================================');
    console.info('🔐 [Webhook Asaas] VALIDAÇÃO DE TOKEN:');

    console.info('🔑 [Webhook Asaas] Token recebido:', asaasToken || 'NULO/AUSENTE');
    console.info('🔑 [Webhook Asaas] Token esperado:', expectedToken || 'NULO/AUSENTE');
    console.info('🔑 [Webhook Asaas] Token recebido (length):', asaasToken?.length || 0);
    console.info('🔑 [Webhook Asaas] Token esperado (length):', expectedToken?.length || 0);
    console.info('🔑 [Webhook Asaas] Tokens match (===):', asaasToken === expectedToken);
    console.info('🔑 [Webhook Asaas] Tokens match (trim):', asaasToken?.trim() === expectedToken?.trim());
    console.info('🔐 [Webhook Asaas] ============================================');

    // Validar token (trim para remover espaços)
    const receivedToken = asaasToken?.trim();
    const expectedTokenTrimmed = expectedToken?.trim();
    
    if (!receivedToken) {
      console.error('❌ [Webhook Asaas] Token não fornecido no header');
      console.error('❌ [Webhook Asaas] Headers recebidos:', Object.keys(Object.fromEntries(request.headers.entries())));
      return NextResponse.json(
        { error: 'Unauthorized: Token não fornecido' },
        { status: 401 }
      );
    }

    if (!expectedTokenTrimmed) {
      console.error('❌ [Webhook Asaas] ASAAS_WEBHOOK_TOKEN não configurado no .env');
      console.error('❌ [Webhook Asaas] process.env.ASAAS_WEBHOOK_TOKEN:', process.env.ASAAS_WEBHOOK_TOKEN);
      return NextResponse.json(
        { error: 'Internal Server Error: Webhook token não configurado' },
        { status: 500 }
      );
    }

    if (receivedToken !== expectedTokenTrimmed) {
      console.error('❌ [Webhook Asaas] Token inválido');
      console.error('   Recebido (trim):', receivedToken);
      console.error('   Esperado (trim):', expectedTokenTrimmed);
      console.error('   Recebido (raw):', asaasToken);
      console.error('   Esperado (raw):', expectedToken);
      return NextResponse.json(
        { error: 'Unauthorized: Token inválido' },
        { status: 401 }
      );
    }

    console.info('✅ [Webhook Asaas] Token validado com sucesso');

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

    // Se não há payment (ex.: SUBSCRIPTION_*), ainda processamos para vincular/atualizar
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
    const paymentValidationOutput = await paymentValidationUseCase.processWebhook({
      event: body.event,
      payment: hasPayment ? body.payment : body.subscription,
    });

    const result =
      (paymentValidationOutput.result as PaymentValidationResult | null) ?? null;
    const isPaid = result?.isPaid === true;

    console.info('[AsaasWebhookRoute][POST] Payment validation output:', {
      isValid: paymentValidationOutput.isValid,
      errorMessages: paymentValidationOutput.errorMessages,
      result,
    });

    // VERIFICAR SE É PAGAMENTO DE OPERADOR (PAYMENT_CONFIRMED ou outros eventos)
    // Detectar através do externalReference que contém "pending-operator-{id}"
    if (body?.payment?.id) {
      const paymentId = body.payment.id;
      // ExternalReference pode vir no payment OU na subscription
      const externalReference = body.payment.externalReference || body.subscription?.externalReference;
      const paymentStatus = body.payment.status;
      const checkoutSessionId = body.payment.checkoutSession;
      
        console.info('💳 [Webhook Asaas] Detalhes do pagamento:', {
          event: body.event,
          paymentId,
          status: paymentStatus,
          checkoutSessionId: checkoutSessionId || 'não definido',
          externalReference: externalReference || 'não definido',
          externalRefFromPayment: body.payment.externalReference || 'null',
          externalRefFromSubscription: body.subscription?.externalReference || 'null',
          isPaid
        });
      
      // Verificar se é pagamento de operador através do checkoutSessionId
      // Buscar diretamente no banco porque o Asaas não retorna externalReference no webhook
      let isOperatorPayment = false;
      let isPendingActionPayment = false;
      
      if (checkoutSessionId) {
        try {
          const { prisma } = await import('@/app/api/infra/data/prisma');
          const pendingOperator = await prisma.pendingOperator.findFirst({
            where: { paymentId: checkoutSessionId }
          });
          
          isOperatorPayment = !!pendingOperator;

          const pendingAction = await prisma.pendingAction.findFirst({
            where: { checkoutId: checkoutSessionId, status: 'pending' }
          });

          isPendingActionPayment = !!pendingAction;
          
          console.info('🔍 [Webhook Asaas] Verificação de operador:', {
            hasCheckoutSessionId: true,
            checkoutSessionId,
            pendingOperatorFound: isOperatorPayment,
            pendingActionFound: isPendingActionPayment,
            willProcess: isOperatorPayment && (isPaid || paymentStatus === 'CONFIRMED')
          });
        } catch (error) {
          console.error('❌ [Webhook Asaas] Erro ao verificar pendingOperator:', error);
        }
      } else {
        console.info('🔍 [Webhook Asaas] Sem checkoutSessionId - não é pagamento de operador');
      }
      
      if (isOperatorPayment && (isPaid || paymentStatus === 'CONFIRMED')) {
        try {
          console.info('🔄 [Webhook Asaas] Detectado pagamento de OPERADOR (checkout)');
          console.info('📋 [Webhook Asaas] CheckoutSessionId:', checkoutSessionId);
          console.info('📋 [Webhook Asaas] PaymentId:', paymentId);
          console.info('📋 [Webhook Asaas] ExternalReference:', externalReference);
          
          // Usar novo fluxo de checkout para operadores
          // Passar paymentId para buscar no Asaas
          const { checkoutAsaasUseCase } = await import('@/app/api/useCases/subscriptions/CheckoutAsaasUseCase');
          const operatorResult = await checkoutAsaasUseCase.processOperatorCheckoutPaid(checkoutSessionId, paymentId);
          
          if (operatorResult.isValid) {
            console.info('🎉 [Webhook Asaas] ✅ OPERADOR CRIADO COM SUCESSO (checkout):', {
              operatorId: operatorResult.result?.operatorId,
              operatorEmail: operatorResult.result?.operatorEmail,
              paymentId
            });
          } else {
            console.error('❌ [Webhook Asaas] ❌ FALHA AO CRIAR OPERADOR (checkout):', {
              errorMessages: operatorResult.errorMessages,
              paymentId,
              externalReference
            });
          }
        } catch (error) {
          console.error('❌ [Webhook Asaas] Erro ao processar checkout de operador:', error);
          // Não bloquear o fluxo principal
        }
      } else if (!isOperatorPayment) {
        console.info('ℹ️ [Webhook Asaas] Não é pagamento de operador (externalReference diferente)');
      }

      if (isPendingActionPayment && (isPaid || paymentStatus === 'CONFIRMED')) {
        try {
          console.info('🔄 [Webhook Asaas] Detectado pagamento de AÇÃO PENDENTE (checkout)');
          const { pendingActionUseCase } = await import('@/app/api/useCases/pendingActions/PendingActionUseCase');
          const actionResult = await pendingActionUseCase.applyPendingActionByCheckout(checkoutSessionId, paymentId);

          if (actionResult.isValid) {
            console.info('✅ [Webhook Asaas] Ação pendente aplicada com sucesso');
          } else {
            console.error('❌ [Webhook Asaas] Falha ao aplicar ação pendente:', actionResult.errorMessages);
          }
        } catch (error) {
          console.error('❌ [Webhook Asaas] Erro ao aplicar ação pendente:', error);
        }
      }

      const isPendingActionRef = !!externalReference && externalReference.startsWith('pending-action-');
      if (!isPendingActionPayment && isPendingActionRef && (isPaid || paymentStatus === 'CONFIRMED')) {
        try {
          console.info('🔄 [Webhook Asaas] Detectado pagamento de AÇÃO PENDENTE (payment)');
          const { pendingActionUseCase } = await import('@/app/api/useCases/pendingActions/PendingActionUseCase');
          const actionResult = await pendingActionUseCase.applyPendingActionByPaymentId(paymentId);

          if (actionResult.isValid) {
            console.info('✅ [Webhook Asaas] Ação pendente aplicada com sucesso (payment)');
          } else {
            console.error('❌ [Webhook Asaas] Falha ao aplicar ação pendente (payment):', actionResult.errorMessages);
          }
        } catch (error) {
          console.error('❌ [Webhook Asaas] Erro ao aplicar ação pendente (payment):', error);
        }
      }

      const isPendingOperatorRef = !!externalReference && externalReference.startsWith('pending-operator-');
      if (!isOperatorPayment && isPendingOperatorRef && isPaid) {
        try {
          console.info('?? [Webhook Asaas] Detectado pagamento de OPERADOR via externalReference');
          const { subscriptionUpgradeUseCase } = await import('@/app/api/useCases/subscriptions/SubscriptionUpgradeUseCase');
          const operatorResult = await subscriptionUpgradeUseCase.confirmPaymentAndCreateOperator(paymentId);

          if (operatorResult.isValid) {
            console.info('?? [Webhook Asaas] ? OPERADOR CRIADO COM SUCESSO (externalRef):', {
              operatorId: operatorResult.result?.operatorId,
              operatorEmail: operatorResult.result?.operatorEmail,
              paymentId
            });
          } else {
            console.error('? [Webhook Asaas] ? FALHA AO CRIAR OPERADOR (externalRef):', {
              errorMessages: operatorResult.errorMessages,
              paymentId,
              externalReference
            });
          }
        } catch (error) {
          console.error('? [Webhook Asaas] Erro ao processar pagamento de operador (externalRef):', error);
        }
      }
    }

    // ATIVAR ASSINATURA APÓS PAGAMENTO CONFIRMADO (SIGN-UP FLOW)
    if (isPaid && body?.payment?.subscription) {
      try {
        const { checkoutAsaasUseCase } = await import('@/app/api/useCases/subscriptions/CheckoutAsaasUseCase');
        const activationResult = await checkoutAsaasUseCase.processCheckoutPaid(body.payment.id);
        
        if (activationResult.isValid) {
          console.info('✅ [Webhook Asaas] Assinatura ativada após pagamento:', body.payment.subscription);
        }
      } catch (error) {
        console.error('❌ [Webhook Asaas] Erro ao ativar assinatura:', error);
      }
    }

    // SINCRONIZAR EVENTOS DE ASSINATURA (SUBSCRIPTION_CREATED, SUBSCRIPTION_UPDATED)
    // Usado quando assinatura do manager é atualizada (add/remove operadores)
    if (body.event === 'SUBSCRIPTION_CREATED' || body.event === 'SUBSCRIPTION_UPDATED') {
      const subscription = body.subscription;
      
      if (subscription?.id && subscription?.customer) {
        try {
          console.info('🔄 [Webhook Asaas] Sincronizando assinatura:', {
            event: body.event,
            subscriptionId: subscription.id,
            customerId: subscription.customer,
            value: subscription.value,
            nextDueDate: subscription.nextDueDate
          });

          // Converter data brasileira DD/MM/YYYY para ISO
          const parseBrazilianDate = (dateStr: string): Date | null => {
            if (!dateStr) return null;
            
            const parts = dateStr.split('/');
            if (parts.length !== 3) return null;
            
            const [day, month, year] = parts;
            const isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
            const date = new Date(isoDate);
            
            return isNaN(date.getTime()) ? null : date;
          };

          // Buscar manager pelo asaasCustomerId
          const { prisma } = await import('@/app/api/infra/data/prisma');
          const manager = await prisma.profile.findFirst({
            where: { 
              asaasCustomerId: subscription.customer,
              role: 'manager'
            }
          });

          if (manager) {
            const nextDueDate = parseBrazilianDate(subscription.nextDueDate);
            
            console.info('📅 [Webhook Asaas] Convertendo data:', {
              original: subscription.nextDueDate,
              converted: nextDueDate?.toISOString(),
              isValid: nextDueDate !== null
            });

            // Atualizar subscriptionId e nextDueDate no Profile
            const updateData: any = {
              asaasSubscriptionId: subscription.id,
              subscriptionCycle: subscription.cycle || 'MONTHLY',
            };

            if (nextDueDate) {
              updateData.subscriptionNextDueDate = nextDueDate;
            }

            await prisma.profile.update({
              where: { id: manager.id },
              data: updateData
            });

            console.info('✅ [Webhook Asaas] Assinatura sincronizada para manager:', {
              managerId: manager.id,
              email: manager.email,
              newSubscriptionId: subscription.id
            });
          } else {
            console.warn('⚠️ [Webhook Asaas] Manager não encontrado para customerId:', subscription.customer);
          }
        } catch (error) {
          console.error('❌ [Webhook Asaas] Erro ao sincronizar assinatura:', error);
          // Não bloquear o fluxo principal
        }
      }
    }

    // Se o pagamento foi confirmado, notificar o frontend via endpoint público
    if (isPaid && body?.payment?.subscription) {
      const subscriptionId = body.payment.subscription;
      console.info('💾 [Webhook Asaas] Notificando frontend para subscriptionId:', subscriptionId);
      
      try {
        // Chamar endpoint de notificação (não bloqueia a resposta ao Asaas)
        const notifyUrl = getFullUrl(`/api/v1/subscriptions/${subscriptionId}/notify-payment`);
        
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
      { success: true, message: 'Webhook processado', isPaid },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[AsaasWebhookRoute][POST] Unexpected error:', error);
    
    // Mesmo em caso de erro, retornar 200 para não pausar a fila do Asaas
    // Log do erro deve ser suficiente para investigação
    return NextResponse.json(
      { success: false, message: 'Erro processado' },
      { status: 200 }
    );
  }
}
