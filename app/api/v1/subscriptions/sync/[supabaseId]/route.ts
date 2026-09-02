import { NextRequest, NextResponse } from 'next/server';
import { Output } from '@/lib/output';
import { prisma } from '@/app/api/infra/data/prisma';
import { AsaasSubscriptionService } from '@/app/api/services/AsaasSubscription/AsaasSubscriptionService';
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';
import type { AsaasAccountId } from '@/lib/asaas';

const TERMINAL_ASAAS_STATUSES = new Set(['EXPIRED', 'INACTIVE']);

type SyncedSubscription = {
  id: string;
  status?: string;
  value: number;
  cycle: string;
  nextDueDate?: string;
  dateCreated?: string;
};

/**
 * Aplica o resultado conclusivo (ACTIVE ou terminal) de UMA assinatura ao
 * profile local. Compartilhado entre o lookup direto pelo ponteiro
 * conhecido (3a) e o achado ACTIVE da varredura de lista (fallback), para
 * não duplicar a lógica de escrita/log em dois lugares.
 */
async function applyActiveSubscription(supabaseId: string, activeSubscription: SyncedSubscription) {
  console.info('✅ [SyncSubscription] Assinatura ativa encontrada:', {
    id: activeSubscription.id,
    status: activeSubscription.status,
    value: activeSubscription.value,
    nextDueDate: activeSubscription.nextDueDate,
  });

  const subscriptionPlan: 'manager_base' | 'with_operators' | 'free_trial' =
    activeSubscription.value <= 20 ? 'with_operators' : 'manager_base';

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

  return new Output(true, ['Assinatura sincronizada com sucesso'], [], updatedProfile);
}

async function applyTerminalSubscription(supabaseId: string, terminalSubscription: SyncedSubscription) {
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

  return new Output(true, ['Assinatura cancelada/expirada confirmada no Asaas'], [], updatedProfile);
}

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
    // DA7 (achado P1 Cursor round 2): `sub_` e `cus_` podem estar em contas
    // DIFERENTES durante a janela dual — o GET de uma assinatura por ID
    // MUST usar a conta da própria assinatura, não a do customer.
    const subscriptionAccount: AsaasAccountId = profile.asaasSubscriptionAccount ?? 'primary';
    const knownSubscriptionId = profile.asaasSubscriptionId;

    // 3a. Se já existe um ponteiro de assinatura conhecido, consultar ELE
    // diretamente (DA2) em vez de inferir de uma página da lista. Achado P1
    // do Codex: listSubscriptions({ limit: 5 }) pode deixar a assinatura
    // ativa fora da janela enquanto uma antiga EXPIRED/INACTIVE aparece
    // dentro dela — inferir status dali rebaixava (indevidamente) quem
    // ainda paga. Consultar o ID conhecido é inequívoco: é a assinatura
    // atual do profile, não "uma das últimas 5".
    if (knownSubscriptionId) {
      try {
        const current = await AsaasSubscriptionService.getSubscription(knownSubscriptionId, subscriptionAccount);

        if (current.status === 'ACTIVE') {
          return NextResponse.json(await applyActiveSubscription(supabaseId, current), { status: 200 });
        }
        if (TERMINAL_ASAAS_STATUSES.has(current.status)) {
          return NextResponse.json(await applyTerminalSubscription(supabaseId, current), { status: 200 });
        }
        console.info('ℹ️ [SyncSubscription] Assinatura conhecida em status não conclusivo — sem alteração', {
          supabaseId,
          knownSubscriptionId,
          status: current.status,
        });
        return NextResponse.json(
          new Output(true, ['Nenhuma assinatura em status conclusivo — nenhuma alteração foi feita'], [], null),
          { status: 200 },
        );
      } catch (getError) {
        // getSubscription() colapsa 404 (assinatura de fato removida) e
        // erro transiente de rede na mesma Error genérica — DA3 exige
        // evidência inequívoca, então cai para a varredura da lista abaixo
        // em vez de assumir cancelamento por um erro ambíguo.
        console.warn('⚠️ [SyncSubscription] Lookup direto da assinatura conhecida falhou — caindo para varredura da lista', {
          supabaseId,
          knownSubscriptionId,
          account: subscriptionAccount,
          error: getError,
        });
      }
    }

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
        { limit: 20 },
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

      // DA2/DA3 + achado P1 do Codex: esta lista é uma PÁGINA (limit=20),
      // não o histórico completo. Um registro terminal aqui só é evidência
      // válida de que a assinatura ATUAL do profile acabou se ele bater com
      // o ponteiro conhecido (ou não houver ponteiro ainda — primeiro sync,
      // nada a proteger). Um EXPIRED/INACTIVE de uma assinatura ANTIGA
      // diferente da atual nunca deve rebaixar quem ainda paga.
      if (
        !terminalSubscription ||
        (knownSubscriptionId && terminalSubscription.id !== knownSubscriptionId)
      ) {
        console.info('ℹ️ [SyncSubscription] Assinaturas encontradas sem evidência conclusiva para a assinatura atual — sem alteração', {
          supabaseId,
          knownSubscriptionId,
          statuses: subscriptions.map((sub) => sub.status),
        });
        return NextResponse.json(
          new Output(true, ['Nenhuma assinatura em status conclusivo — nenhuma alteração foi feita'], [], null),
          { status: 200 }
        );
      }

      return NextResponse.json(await applyTerminalSubscription(supabaseId, terminalSubscription), { status: 200 });
    }

    return NextResponse.json(await applyActiveSubscription(supabaseId, activeSubscription), { status: 200 });

  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error('❌ [SyncSubscription] Erro ao sincronizar:', error);
    
    return NextResponse.json(
      new Output(false, [], ['Erro ao sincronizar assinatura'], null),
      { status: 500 }
    );
  }
}
