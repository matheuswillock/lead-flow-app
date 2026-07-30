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
      console.warn('[useWebhookListener] Hook desabilitado:', { enabled, subscriptionId });
      return;
    }

    console.info('[useWebhookListener] Escutando confirmacao para:', subscriptionId);

    const MAX_ATTEMPTS = 100;
    let attempts = 0;

    // Polling simples verificando o endpoint
    const checkInterval = setInterval(async () => {
      attempts += 1;
      if (attempts > MAX_ATTEMPTS) {
        console.warn('[useWebhookListener] Limite de tentativas atingido. Encerrando polling.');
        clearInterval(checkInterval);
        return;
      }

      try {
        console.info('[useWebhookListener] Verificando pagamento...');

        const response = await fetch(
          `/api/v1/subscriptions/${subscriptionId}/notify-payment`
        );

        if (!response.ok) {
          console.warn('[useWebhookListener] Erro ao verificar:', response.status);
          return;
        }

        const data = await response.json();

        console.info('[useWebhookListener] Resposta recebida:', {
          isPaid: data.isPaid,
          hasData: !!data
        });

        if (data.isPaid) {
          console.info('[useWebhookListener] Pagamento confirmado via webhook!');
          clearInterval(checkInterval);
          onPaymentConfirmed();
        }
      } catch (error) {
        console.error('[useWebhookListener] Erro:', error);
      }
    }, 3000); // Verificar a cada 3 segundos

    return () => {
      console.info('[useWebhookListener] Limpando interval');
      clearInterval(checkInterval);
    };
  }, [subscriptionId, onPaymentConfirmed, enabled]);
}
