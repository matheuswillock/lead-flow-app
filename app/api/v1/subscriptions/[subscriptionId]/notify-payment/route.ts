// app/api/v1/subscriptions/[subscriptionId]/notify-payment/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/api/infra/data/prisma';

// Cache simples em memória para confirmações de pagamento
// Em produção, usar Redis ou similar
const paymentConfirmations = new Map<string, {
  timestamp: number;
  paymentId: string;
}>();

/**
 * Endpoint público para webhook notificar confirmação de pagamento
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ subscriptionId: string }> }
) {
  try {
    const { subscriptionId } = await params;
    const body = await request.json();

    console.info('✅ [NotifyPaymentController] Notificação recebida para:', subscriptionId);
    console.info('📦 [NotifyPaymentController] Body:', body);

    // Salvar confirmação em memória (cache temporário)
    paymentConfirmations.set(subscriptionId, {
      timestamp: Date.now(),
      paymentId: body.paymentId || 'unknown'
    });

    // Limpar confirmações antigas (mais de 1 hora)
    for (const [key, value] of paymentConfirmations.entries()) {
      if (Date.now() - value.timestamp > 3600000) { // 1 hora
        paymentConfirmations.delete(key);
      }
    }
    
    return NextResponse.json({
      success: true,
      message: 'Notificação processada',
      subscriptionId,
      timestamp: Date.now()
    }, { status: 200 });

  } catch (error) {
    console.error('❌ [NotifyPaymentController] Erro:', error);
    
    return NextResponse.json(
      { error: 'Erro ao processar notificação' },
      { status: 500 }
    );
  }
}

/**
 * Endpoint GET para frontend verificar se já foi notificado
 * Verifica no cache em memória se o pagamento foi confirmado
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ subscriptionId: string }> }
) {
  try {
    const { subscriptionId } = await params;

    console.info('🔍 [NotifyPaymentController] Verificação para:', subscriptionId);

    // Verificar no cache em memória primeiro (mais rápido)
    const confirmation = paymentConfirmations.get(subscriptionId);
    
    if (confirmation) {
      console.info('✅ [NotifyPaymentController] Pagamento confirmado (cache)!');
      return NextResponse.json({
        isPaid: true,
        subscriptionId,
        profileExists: false, // Profile será criado no sign-up
        message: 'Pagamento confirmado',
        timestamp: confirmation.timestamp
      });
    }

    // Se não encontrar no cache, verificar no banco
    // (caso o servidor tenha reiniciado)
    const profile = await prisma.profile.findFirst({
      where: {
        subscriptionId: subscriptionId,
        subscriptionStatus: 'active'
      },
      select: {
        id: true,
        subscriptionId: true,
        subscriptionStatus: true
      }
    });

    if (profile) {
      console.info('✅ [NotifyPaymentController] Pagamento confirmado (banco)!', profile.id);
      return NextResponse.json({
        isPaid: true,
        subscriptionId,
        profileExists: true,
        message: 'Pagamento confirmado e profile criado'
      });
    }

    console.info('⏳ [NotifyPaymentController] Aguardando confirmação...');
    return NextResponse.json({
      isPaid: false,
      subscriptionId,
      profileExists: false,
      message: 'Aguardando confirmação de pagamento'
    });

  } catch (error) {
    console.error('❌ [NotifyPaymentController] Erro:', error);
    
    return NextResponse.json(
      { error: 'Erro ao verificar notificação' },
      { status: 500 }
    );
  }
}
