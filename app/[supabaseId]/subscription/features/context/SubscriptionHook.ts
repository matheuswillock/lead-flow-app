'use client';

import { useCallback, useRef, useState } from 'react';
import type {
  ISubscriptionContext,
  UseSubscriptionHookProps,
  UseSubscriptionHookReturn,
  UpdateSubscriptionCreditsDTO,
  UpdatePaymentMethodDTO
} from '../types/subscription.types';
import { toUserToastMessage } from "@/lib/ui/to-user-toast-message";
import {
  readLastSeenSubscriptionAt,
  resolveSubscriptionEmptyStateReason,
  writeLastSeenSubscriptionAt,
} from '../utils/subscription-empty-state';

export function useSubscriptionHook({
  supabaseId,
  service
}: UseSubscriptionHookProps): UseSubscriptionHookReturn {

  const [state, setState] = useState<ISubscriptionContext>({
    subscription: null,
    invoices: [],
    isLoading: true,
    error: null,
    emptyStateReason: null,
    invoicesError: null,
    fetchSubscription: async () => {},
    fetchInvoices: async () => {},
    syncSubscription: async () => {},
    updateCredits: async () => ({}),
    cancelSubscription: async () => {},
    updatePaymentMethod: async () => {},
    retryPayment: async () => {}
  });

  // Disciplina de effect (E6): chave estável de request + in-flight guard,
  // copiando o modelo interno já correto de EmailCreditsCard.tsx (que também
  // não usa AbortController real — o fetch da API não aceita `signal` hoje).
  // `key` identifica a chamada mais recente (troca de `supabaseId` "aborta"
  // a anterior ao fazer a resposta tardia ser ignorada); `inFlight` evita 2
  // requests simultâneos para a MESMA chave (StrictMode dev dispara
  // mount/unmount/mount).
  const subscriptionRequestRef = useRef<{ key: string; inFlight: boolean } | null>(null);
  /**
   * `token` monotônico: identifica a requisição MAIS RECENTE de faturas.
   * Achado P2 da revisão do PR #1207 (thread PRRT_...dNdY): só a chave não
   * bastava — depois de uma mutação (`syncSubscription`), o `fetchInvoices`
   * de follow-up era descartado pelo guard de in-flight e o GET antigo, já
   * em voo, populava faturas desatualizadas. Com o token, a chamada forçada
   * invalida a anterior em vez de se descartar.
   */
  const invoicesRequestRef = useRef<{ key: string; token: number; inFlight: boolean } | null>(null);
  const invoicesTokenRef = useRef(0);

  const fetchSubscription = useCallback(async () => {
    const requestKey = `subscription:${supabaseId}`;
    if (subscriptionRequestRef.current?.key === requestKey && subscriptionRequestRef.current.inFlight) {
      return;
    }
    subscriptionRequestRef.current = { key: requestKey, inFlight: true };

    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const subscription = await service.getSubscription(supabaseId);
      if (subscriptionRequestRef.current?.key !== requestKey) return; // supabaseId mudou — resposta obsoleta

      if (subscription) {
        writeLastSeenSubscriptionAt(supabaseId);
      }
      const emptyStateReason = subscription
        ? null
        : resolveSubscriptionEmptyStateReason({
            lastSeenSubscriptionAt: readLastSeenSubscriptionAt(supabaseId),
          });

      setState(prev => ({
        ...prev,
        subscription,
        emptyStateReason,
        isLoading: false
      }));
    } catch (error) {
      if (subscriptionRequestRef.current?.key !== requestKey) return;
      setState(prev => ({
        ...prev,
        error: toUserToastMessage(error),
        isLoading: false
      }));
    } finally {
      if (subscriptionRequestRef.current?.key === requestKey) {
        subscriptionRequestRef.current.inFlight = false;
      }
    }
  }, [service, supabaseId]);

  const fetchInvoices = useCallback(async (options?: { force?: boolean }) => {
    const requestKey = `invoices:${supabaseId}`;
    const isDuplicateRead =
      invoicesRequestRef.current?.key === requestKey && invoicesRequestRef.current.inFlight;
    // Dedupe de leitura continua valendo (StrictMode, efeitos repetidos).
    // Achado P2 (thread PRRT_...dNdY): follow-up de MUTAÇÃO não pode ser
    // engolido por esse dedupe — força uma requisição nova, e o token novo
    // invalida a que estava em voo, cujo resultado já é velho.
    if (isDuplicateRead && !options?.force) {
      return;
    }

    invoicesTokenRef.current += 1;
    const requestToken = invoicesTokenRef.current;
    invoicesRequestRef.current = { key: requestKey, token: requestToken, inFlight: true };

    const isStale = () =>
      invoicesRequestRef.current?.key !== requestKey ||
      invoicesRequestRef.current.token !== requestToken;

    try {
      const invoices = await service.getInvoices(supabaseId);
      if (isStale()) return;
      setState(prev => ({ ...prev, invoices, invoicesError: null }));
    } catch (error) {
      if (isStale()) return;
      // DA3: falha ao carregar faturas vira estado de erro dedicado — nunca
      // aparece como "Nenhuma fatura encontrada" (empty state real).
      console.error('Erro ao buscar faturas:', error);
      setState(prev => ({ ...prev, invoicesError: toUserToastMessage(error) }));
    } finally {
      if (!isStale()) {
        invoicesRequestRef.current.inFlight = false;
      }
    }
  }, [service, supabaseId]);

  const cancelSubscription = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      await service.cancelSubscription(supabaseId);
      await fetchSubscription(); // Recarregar dados
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: toUserToastMessage(error),
        isLoading: false
      }));
      throw error;
    }
  }, [service, supabaseId, fetchSubscription]);

  const syncSubscription = useCallback(async () => {
    // E2 (item 5): sync é uma ação de refresh acionada pelo usuário, não o
    // load inicial da página — uma falha aqui NÃO pode trocar o container
    // inteiro por `SubscriptionError` e apagar dados já renderizados. O
    // chamador (`SubscriptionContainer.handleSync`) decide como avisar o
    // usuário (toast) e mantém a tela como estava.
    await service.syncSubscription(supabaseId);
    await fetchSubscription();
    // `force`: follow-up de mutação (achado P2, thread PRRT_...dNdY) — o
    // GET inicial de faturas pode ainda estar em voo e traria dado anterior
    // ao sync.
    await fetchInvoices({ force: true });
  }, [service, supabaseId, fetchSubscription, fetchInvoices]);

  const updateCredits = useCallback(async (data: UpdateSubscriptionCreditsDTO) => {
    setState(prev => ({ ...prev, error: null }));
    const result = await service.updateCredits(supabaseId, data);
    if (data.action === 'remove') {
      await fetchSubscription();
    }
    return result;
  }, [service, supabaseId, fetchSubscription]);

  const updatePaymentMethod = useCallback(async (cardData: UpdatePaymentMethodDTO) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      await service.updatePaymentMethod(supabaseId, cardData);
      await fetchSubscription(); // Recarregar dados
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: toUserToastMessage(error),
        isLoading: false
      }));
      throw error;
    }
  }, [service, supabaseId, fetchSubscription]);

  const retryPayment = useCallback(async (invoiceId: string) => {
    try {
      await service.retryPayment(supabaseId, invoiceId);
      // `force`: idem — retry de pagamento é mutação, o refresh não pode
      // ser engolido pelo dedupe de leitura (achado P2, PRRT_...dNdY).
      await fetchInvoices({ force: true }); // Recarregar faturas
    } catch (error) {
      console.error('Erro ao retentar pagamento:', error);
      throw error;
    }
  }, [service, supabaseId, fetchInvoices]);

  return {
    ...state,
    fetchSubscription,
    fetchInvoices,
    syncSubscription,
    updateCredits,
    cancelSubscription,
    updatePaymentMethod,
    retryPayment
  };
}
