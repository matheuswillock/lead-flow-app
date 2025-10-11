'use client';

import React, { createContext, useContext, useEffect } from 'react';
import { useParams } from 'next/navigation';
import type {
  ISubscriptionContext,
  ISubscriptionProviderProps
} from '../types/subscription.types';
import { useSubscriptionHook } from './SubscriptionHook';
import { subscriptionService } from '../services/SubscriptionService';

const SubscriptionContext = createContext<ISubscriptionContext | undefined>(undefined);

export const SubscriptionProvider: React.FC<ISubscriptionProviderProps> = ({ children }) => {
  const params = useParams();
  const supabaseId = params.supabaseId as string;

  const contextState = useSubscriptionHook({
    supabaseId,
    service: subscriptionService
  });

  // Carregar dados ao montar
  useEffect(() => {
    contextState.fetchSubscription();
    contextState.fetchInvoices();
  }, [supabaseId]);

  return (
    <SubscriptionContext.Provider value={contextState}>
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscriptionContext = () => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscriptionContext must be used within SubscriptionProvider');
  }
  return context;
};
