'use client';

import { useState, useCallback } from 'react';
import type {
  ISubscriptionContext,
  UseSubscriptionHookProps,
  UseSubscriptionHookReturn,
  UpdatePaymentMethodDTO
} from '../types/subscription.types';

export function useSubscriptionHook({
  supabaseId,
  service
}: UseSubscriptionHookProps): UseSubscriptionHookReturn {
  
  const [state, setState] = useState<ISubscriptionContext>({
    subscription: null,
    invoices: [],
    isLoading: true,
    error: null,
    fetchSubscription: async () => {},
    fetchInvoices: async () => {},
    cancelSubscription: async () => {},
    updatePaymentMethod: async () => {},
    retryPayment: async () => {}
  });

  const fetchSubscription = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const subscription = await service.getSubscription(supabaseId);
      setState(prev => ({ 
        ...prev, 
        subscription, 
        isLoading: false 
      }));
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Erro ao carregar assinatura', 
        isLoading: false 
      }));
    }
  }, [service, supabaseId]);

  const fetchInvoices = useCallback(async () => {
    try {
      const invoices = await service.getInvoices(supabaseId);
      setState(prev => ({ ...prev, invoices }));
    } catch (error) {
      console.error('Erro ao buscar faturas:', error);
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
        error: error instanceof Error ? error.message : 'Erro ao cancelar assinatura',
        isLoading: false
      }));
      throw error;
    }
  }, [service, supabaseId, fetchSubscription]);

  const updatePaymentMethod = useCallback(async (cardData: UpdatePaymentMethodDTO) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      await service.updatePaymentMethod(supabaseId, cardData);
      await fetchSubscription(); // Recarregar dados
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Erro ao atualizar método de pagamento',
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
    cancelSubscription,
    updatePaymentMethod,
    retryPayment
  };
}
