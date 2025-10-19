'use client';

import { useSubscriptionContext } from '../context/SubscriptionContext';
import { SubscriptionCard } from './SubscriptionCard';
import { SubscriptionError } from './SubscriptionError';
import { SubscriptionHeader } from './SubscriptionHeader';
import { SubscriptionInvoices } from './SubscriptionInvoices';
import { SubscriptionSkeleton } from './SubscriptionSkeleton';

export function SubscriptionContainer() {
  const {
    subscription,
    invoices,
    isLoading,
    error,
    fetchSubscription,
    fetchInvoices,
    cancelSubscription
  } = useSubscriptionContext();

  if (isLoading && !subscription) {
    return <SubscriptionSkeleton />;
  }

  if (error) {
    return (
      <SubscriptionError 
        error={error} 
        onRetry={() => {
          fetchSubscription();
          fetchInvoices();
        }} 
      />
    );
  }

  if (!subscription) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <p className="text-lg text-muted-foreground">
          Nenhuma assinatura ativa encontrada
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SubscriptionHeader />
      
      <div className="grid gap-6 md:grid-cols-2">
        <SubscriptionCard 
          subscription={subscription}
          onCancel={cancelSubscription}
        />
      </div>

      <SubscriptionInvoices invoices={invoices} />
    </div>
  );
}
