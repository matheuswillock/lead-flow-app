// hooks/useWebhookListener.ts
'use client';

import { useEffect } from 'react';

interface WebhookListenerOptions {
  subscriptionId: string | null;
  onPaymentConfirmed: () => void;
  enabled?: boolean;
}

/**
 * Hook para escutar quando o webhook confirmar o pagamento
 * Faz polling simples verificando no banco se o pagamento foi confirmado
 */
export function useWebhookListener({
  subscriptionId,
  onPaymentConfirmed,
  enabled = true,
}: WebhookListenerOptions) {
  
  useEffect(() => {
    if (!enabled || !subscriptionId) {
      return;
    }

    console.info('👂 [useWebhookListener] Escutando confirmação para:', subscriptionId);
    
    // Polling simples verificando o endpoint
    const checkInterval = setInterval(async () => {
      try {
        const response = await fetch(
          `/api/v1/subscriptions/${subscriptionId}/notify-payment`
        );
        
        if (!response.ok) {
          console.warn('⚠️ [useWebhookListener] Erro ao verificar:', response.status);
          return;
        }

        const data = await response.json();
        
        if (data.isPaid) {
          console.info('✅ [useWebhookListener] Pagamento confirmado via webhook!');
          clearInterval(checkInterval);
          onPaymentConfirmed();
        }
      } catch (error) {
        console.error('❌ [useWebhookListener] Erro:', error);
      }
    }, 3000); // Verificar a cada 3 segundos

    return () => {
      clearInterval(checkInterval);
    };
  }, [subscriptionId, onPaymentConfirmed, enabled]);
}
