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
  const invoicesRequestRef = useRef<{ key: string; inFlight: boolean } | null>(null);

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

  const fetchInvoices = useCallback(async () => {
    const requestKey = `invoices:${supabaseId}`;
    if (invoicesRequestRef.current?.key === requestKey && invoicesRequestRef.current.inFlight) {
      return;
    }
    invoicesRequestRef.current = { key: requestKey, inFlight: true };

    try {
      const invoices = await service.getInvoices(supabaseId);
      if (invoicesRequestRef.current?.key !== requestKey) return;
      setState(prev => ({ ...prev, invoices, invoicesError: null }));
    } catch (error) {
      if (invoicesRequestRef.current?.key !== requestKey) return;
      // DA3: falha ao carregar faturas vira estado de erro dedicado — nunca
      // aparece como "Nenhuma fatura encontrada" (empty state real).
      console.error('Erro ao buscar faturas:', error);
      setState(prev => ({ ...prev, invoicesError: toUserToastMessage(error) }));
    } finally {
      if (invoicesRequestRef.current?.key === requestKey) {
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
    await fetchInvoices();
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
      await fetchInvoices(); // Recarregar faturas
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
