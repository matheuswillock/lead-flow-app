import { NextRequest, NextResponse } from 'next/server';
import { Output } from '@/lib/output';
import { prisma } from '@/app/api/infra/data/prisma';
import { AsaasSubscriptionService } from '@/app/api/services/AsaasSubscription/AsaasSubscriptionService';
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';
import type { AsaasAccountId } from '@/lib/asaas';

const TERMINAL_ASAAS_STATUSES = new Set(['EXPIRED', 'INACTIVE']);

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

    // 3. Buscar assinaturas no Asaas (DA2: roteia pela conta do ponteiro
    // armazenado — cus_ pode pertencer à conta legacy durante a janela dual).
    const customerAccount: AsaasAccountId = profile.asaasCustomerAccount ?? 'primary';
    console.info('📞 [SyncSubscription] Buscando assinaturas no Asaas para customer:', {
      asaasCustomerId: profile.asaasCustomerId,
      account: customerAccount,
    });

    // Sem filtro de status: DA3 (C18/C29) exige evidência POSITIVA para
    // downgrade — precisamos ver o status real, não só "existe ACTIVE?".
    let subscriptions: Array<{ id: string; status?: string; value: number; cycle: string; nextDueDate?: string; dateCreated?: string }>;
    try {
      subscriptions = await AsaasSubscriptionService.listSubscriptions(
        profile.asaasCustomerId,
        { limit: 5 },
        customerAccount,
      );
    } catch (listError) {
      // DA3: erro de API NUNCA vira "sem assinaturas" — no-op, log,
      // resposta de erro explícita. Grava `canceled` aqui seria o mesmo
      // bug do C29 (downgrade por falha transitória de rede).
      console.error('❌ [SyncSubscription] Falha ao consultar assinaturas no Asaas — nenhuma alteração local feita', {
        supabaseId,
        asaasCustomerId: profile.asaasCustomerId,
        account: customerAccount,
        error: listError,
      });
      return NextResponse.json(
        new Output(false, [], ['Não foi possível consultar o Asaas. Nenhuma alteração foi feita.'], null),
        { status: 502 }
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
      // DA3: lista vazia NUNCA vira `canceled` — pode ser "nunca teve
      // assinatura", "conta errada" ou um falso-negativo da API. Sem
      // evidência positiva de status terminal, é no-op.
      console.warn('⚠️ [SyncSubscription] Nenhuma assinatura encontrada no Asaas — sem alteração local (DA3)', {
        supabaseId,
        asaasCustomerId: profile.asaasCustomerId,
        account: customerAccount,
      });
      return NextResponse.json(
        new Output(
          true,
          ['Nenhuma assinatura encontrada no Asaas — nenhuma alteração foi feita'],
          [],
          null
        ),
        { status: 200 }
      );
    }

    const activeSubscription = subscriptions.find((sub) => sub.status === 'ACTIVE');

    if (!activeSubscription) {
      const terminalSubscription = subscriptions.find(
        (sub) => sub.status && TERMINAL_ASAAS_STATUSES.has(sub.status),
      );

      if (!terminalSubscription) {
        // Existem assinaturas, mas nenhuma ACTIVE nem em status terminal
        // reconhecido (ex.: PENDING de checkout) — evidência insuficiente
        // para qualquer mudança de status local.
        console.info('ℹ️ [SyncSubscription] Assinaturas encontradas sem status ACTIVE/terminal — sem alteração', {
          supabaseId,
          statuses: subscriptions.map((sub) => sub.status),
        });
        return NextResponse.json(
          new Output(true, ['Nenhuma assinatura em status conclusivo — nenhuma alteração foi feita'], [], null),
          { status: 200 }
        );
      }

      // Evidência positiva de status terminal (DA3) — só agora o downgrade
      // é seguro.
      const updatedProfile = await prisma.profile.update({
        where: { supabaseId },
        data: {
          subscriptionStatus: 'canceled',
          updatedAt: new Date(),
        },
      });

      console.info('✅ [SyncSubscription] Assinatura terminal confirmada no Asaas — profile marcado canceled', {
        supabaseId,
        asaasSubscriptionId: terminalSubscription.id,
        asaasStatus: terminalSubscription.status,
      });

      return NextResponse.json(
        new Output(true, ['Assinatura cancelada/expirada confirmada no Asaas'], [], updatedProfile),
        { status: 200 }
      );
    }
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
    rethrowIfPrerenderInterrupted(error);
    console.error('❌ [SyncSubscription] Erro ao sincronizar:', error);
    
    return NextResponse.json(
      new Output(false, [], ['Erro ao sincronizar assinatura'], null),
      { status: 500 }
    );
  }
}
