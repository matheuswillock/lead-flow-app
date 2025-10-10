// hooks/usePaymentPolling.ts
'use client';

import { useEffect, useRef, useState } from 'react';

interface PaymentPollingOptions {
  subscriptionId: string | null;
  onPaymentConfirmed: () => void;
  enabled?: boolean;
  interval?: number; // em milissegundos
  maxAttempts?: number;
}

interface PaymentStatus {
  isPaid: boolean;
  status: string;
  subscriptionStatus?: string;
}

/**
 * Hook para fazer polling do status de pagamento
 * Verifica periodicamente se o pagamento foi confirmado
 */
export function usePaymentPolling({
  subscriptionId,
  onPaymentConfirmed,
  enabled = true,
  interval = 3000, // 3 segundos
  maxAttempts = 100, // máximo 5 minutos (100 * 3s)
}: PaymentPollingOptions) {
  const [isPolling, setIsPolling] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const attemptsRef = useRef(0);

  const checkPaymentStatus = async () => {
    if (!subscriptionId) {
      console.warn('⚠️ [usePaymentPolling] subscriptionId não fornecido');
      return;
    }

    try {
      console.info(`🔍 [usePaymentPolling] Verificando pagamento... (tentativa ${attemptsRef.current + 1}/${maxAttempts})`);
      
      const response = await fetch(`/api/v1/subscriptions/${subscriptionId}/status`);
      
      if (!response.ok) {
        console.error('❌ [usePaymentPolling] Erro ao verificar status:', response.status);
        return;
      }

      const data: PaymentStatus = await response.json();
      
      console.info('📊 [usePaymentPolling] Status recebido:', {
        isPaid: data.isPaid,
        status: data.status,
        subscriptionStatus: data.subscriptionStatus
      });

      // Se o pagamento foi confirmado
      if (data.isPaid || data.subscriptionStatus === 'active') {
        console.info('✅ [usePaymentPolling] Pagamento confirmado!');
        stopPolling();
        onPaymentConfirmed();
        return;
      }

      attemptsRef.current += 1;
      setAttempts(attemptsRef.current);

      // Se atingiu o máximo de tentativas
      if (attemptsRef.current >= maxAttempts) {
        console.warn('⏰ [usePaymentPolling] Tempo limite atingido');
        stopPolling();
      }
    } catch (error) {
      console.error('❌ [usePaymentPolling] Erro:', error);
    }
  };

  const startPolling = () => {
    if (!enabled || !subscriptionId || intervalRef.current) {
      return;
    }

    console.info('▶️ [usePaymentPolling] Iniciando polling...', {
      subscriptionId,
      interval: `${interval}ms`,
      maxAttempts
    });

    setIsPolling(true);
    attemptsRef.current = 0;
    setAttempts(0);

    // Primeira verificação imediata
    checkPaymentStatus();

    // Depois continua verificando no intervalo
    intervalRef.current = setInterval(checkPaymentStatus, interval);
  };

  const stopPolling = () => {
    if (intervalRef.current) {
      console.info('⏸️ [usePaymentPolling] Parando polling');
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      setIsPolling(false);
    }
  };

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, []);

  // Auto-start quando habilitado e subscriptionId disponível
  useEffect(() => {
    if (enabled && subscriptionId && !intervalRef.current) {
      startPolling();
    }

    if (!enabled || !subscriptionId) {
      stopPolling();
    }
  }, [enabled, subscriptionId]);

  return {
    isPolling,
    attempts,
    startPolling,
    stopPolling,
  };
}
