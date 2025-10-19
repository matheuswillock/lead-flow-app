'use client';

import { CreditCard } from 'lucide-react';

export function SubscriptionHeader() {
  return (
    <div className="flex items-center justify-between">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <CreditCard className="h-8 w-8" />
          Gerenciar Assinatura
        </h1>
        <p className="text-muted-foreground">
          Gerencie sua assinatura, método de pagamento e faturas
        </p>
      </div>
    </div>
  );
}
