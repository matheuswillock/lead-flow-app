import { NextRequest, NextResponse } from 'next/server';
import { Output } from '@/lib/output';
import { prisma } from '@/app/api/infra/data/prisma';
import { AsaasSubscriptionService } from '@/app/api/services/AsaasSubscription/AsaasSubscriptionService';

/**
 * POST /api/v1/subscriptions/sync/[supabaseId]
 * Sincroniza dados da assinatura do Asaas com o profile local
 * 
 * Busca assinaturas ativas no Asaas usando o asaasCustomerId e atualiza o profile
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ supabaseId: string }> }
) {
  try {
    const { supabaseId } = await params;

    console.info('🔄 [SyncSubscription] Iniciando sincronização para:', supabaseId);

    // 1. Buscar profile do usuário
    const profile = await prisma.profile.findUnique({
      where: { supabaseId },
    });

    if (!profile) {
      return NextResponse.json(
        new Output(false, [], ['Usuário não encontrado'], null),
        { status: 404 }
      );
    }

    // 2. Verificar se tem asaasCustomerId
    if (!profile.asaasCustomerId) {
      console.warn('⚠️ [SyncSubscription] Profile não possui asaasCustomerId');
      return NextResponse.json(
        new Output(false, [], ['Usuário não possui customer ID no Asaas'], null),
        { status: 400 }
      );
    }

    // 3. Buscar assinaturas ativas no Asaas
    console.info('📞 [SyncSubscription] Buscando assinaturas no Asaas para customer:', profile.asaasCustomerId);
    
    const subscriptions = await AsaasSubscriptionService.listSubscriptions(
      profile.asaasCustomerId,
      { status: 'ACTIVE', limit: 1 }
    );

    if (!subscriptions || subscriptions.length === 0) {
      console.warn('⚠️ [SyncSubscription] Nenhuma assinatura ativa encontrada no Asaas');
      
      // Atualizar profile para status sem assinatura
      const updatedProfile = await prisma.profile.update({
        where: { supabaseId },
        data: {
          subscriptionStatus: 'canceled',
          updatedAt: new Date(),
        },
      });

      return NextResponse.json(
        new Output(
          true,
          ['Nenhuma assinatura ativa encontrada'],
          [],
          updatedProfile
        ),
        { status: 200 }
      );
    }

    // 4. Pegar primeira assinatura ativa
    const activeSubscription = subscriptions[0];
    console.info('✅ [SyncSubscription] Assinatura ativa encontrada:', {
      id: activeSubscription.id,
      status: activeSubscription.status,
      value: activeSubscription.value,
      nextDueDate: activeSubscription.nextDueDate,
    });

    // 5. Determinar plano baseado no valor
    let subscriptionPlan: 'manager_base' | 'with_operators' | 'free_trial' = 'manager_base';
    if (activeSubscription.value <= 20) {
      subscriptionPlan = 'with_operators'; // Operador adicional
    }

    // 6. Atualizar profile com dados da assinatura
    const updatedProfile = await prisma.profile.update({
      where: { supabaseId },
      data: {
        subscriptionId: activeSubscription.id,
        asaasSubscriptionId: activeSubscription.id,
        subscriptionStatus: 'active', // Asaas retornou ACTIVE
        subscriptionPlan: subscriptionPlan,
        subscriptionCycle: activeSubscription.cycle as 'MONTHLY',
        subscriptionNextDueDate: activeSubscription.nextDueDate 
          ? new Date(activeSubscription.nextDueDate) 
          : null,
        subscriptionStartDate: activeSubscription.dateCreated 
          ? new Date(activeSubscription.dateCreated) 
          : null,
        updatedAt: new Date(),
      },
    });

    console.info('✅ [SyncSubscription] Profile atualizado com sucesso:', {
      subscriptionId: updatedProfile.subscriptionId,
      status: updatedProfile.subscriptionStatus,
      plan: updatedProfile.subscriptionPlan,
    });

    return NextResponse.json(
      new Output(
        true,
        ['Assinatura sincronizada com sucesso'],
        [],
        updatedProfile
      ),
      { status: 200 }
    );

  } catch (error) {
    console.error('❌ [SyncSubscription] Erro ao sincronizar:', error);
    
    return NextResponse.json(
      new Output(false, [], ['Erro ao sincronizar assinatura'], null),
      { status: 500 }
    );
  }
}
