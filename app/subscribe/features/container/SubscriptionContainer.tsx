'use client';

// app/subscribe/features/container/SubscriptionContainer.tsx
import { useState } from 'react';
import { ArrowLeft, Check } from 'lucide-react';
import Link from 'next/link';
import { SubscriptionFormMultiStep } from '../components/SubscriptionFormMultiStep';
import type { SubscriptionState } from '../types/SubscriptionTypes';
import { SubscriptionSuccess } from '../components/SubscriptionSuccess';
import { SubscriptionError } from '../components/SubscriptionError';

export function SubscriptionContainer() {
  const [state, setState] = useState<SubscriptionState>({
    step: 'form',
    loading: false,
    error: null,
  });

  const handleSuccess = (
    customerId: string,
    subscriptionId: string,
    paymentUrl?: string,
    pix?: { encodedImage: string; payload: string; expirationDate: string },
    paymentId?: string,
    boleto?: { bankSlipUrl: string; identificationField: string; barCode: string; dueDate: string }
  ) => {
    console.info('🎯 [SubscriptionContainer] handleSuccess chamado:', {
      customerId,
      subscriptionId,
      hasPaymentUrl: !!paymentUrl,
      hasPix: !!pix,
      hasBoleto: !!boleto,
      hasPaymentId: !!paymentId,
      pixKeys: pix ? Object.keys(pix) : [],
      boletoKeys: boleto ? Object.keys(boleto) : []
    });
    
    setState({
      step: 'success',
      loading: false,
      error: null,
      customerId,
      subscriptionId,
      paymentUrl,
      pix,
      paymentId,
      boleto,
    });
    
    console.info('🎯 [SubscriptionContainer] State atualizado para success');
  };

  const handleError = (error: string) => {
    setState({
      step: 'error',
      loading: false,
      error,
    });
  };

  const handleRetry = () => {
    setState({
      step: 'form',
      loading: false,
      error: null,
    });
  };

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para home
          </Link>
          
          <h1 className="text-3xl font-bold tracking-tight">
            Assine o Lead Flow
          </h1>
          <p className="mt-2 text-muted-foreground">
            Comece a gerenciar seus leads de forma profissional
          </p>
        </div>

        {/* Plan Card */}
        <div className="mb-8 rounded-lg border bg-card p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-semibold">Plano Manager</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Perfeito para corretores que desejam otimizar seu fluxo de vendas
              </p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold">R$ 59,90</div>
              <div className="text-sm text-muted-foreground">/mês</div>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <div className="flex items-center text-sm">
              <Check className="mr-2 h-4 w-4 text-primary" />
              <span>Gestão ilimitada de leads</span>
            </div>
            <div className="flex items-center text-sm">
              <Check className="mr-2 h-4 w-4 text-primary" />
              <span>Dashboard com métricas e analytics</span>
            </div>
            <div className="flex items-center text-sm">
              <Check className="mr-2 h-4 w-4 text-primary" />
              <span>Kanban board interativo</span>
            </div>
            <div className="flex items-center text-sm">
              <Check className="mr-2 h-4 w-4 text-primary" />
              <span>+ R$ 19,90 por operador adicional</span>
            </div>
          </div>
        </div>

        {/* Content based on step */}
        {state.step === 'form' && (
          <SubscriptionFormMultiStep
            onSuccess={handleSuccess}
            onError={handleError}
          />
        )}

        {state.step === 'success' && (
          <SubscriptionSuccess
            subscriptionId={state.subscriptionId!}
            paymentUrl={state.paymentUrl}
            paymentId={state.paymentId}
            pix={state.pix}
            boleto={state.boleto}
          />
        )}

        {state.step === 'error' && (
          <SubscriptionError
            error={state.error!}
            onRetry={handleRetry}
          />
        )}
      </div>
    </div>
  );
}
