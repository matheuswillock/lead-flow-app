'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CreditCard, UserRound } from 'lucide-react';
import type { SubscriptionData } from '../types/subscription.types';

interface SubscriptionCustomerCardProps {
  subscription: SubscriptionData;
}

export function SubscriptionCustomerCard({ subscription }: SubscriptionCustomerCardProps) {
  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <UserRound className="size-5 text-primary" />
          Cliente
        </CardTitle>
        <CardDescription>Dados do responsável pela assinatura</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">Nome</span>
          <span className="font-medium">{subscription.customer.name}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">Email</span>
          <span className="font-medium">{subscription.customer.email}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">Método</span>
          <span className="inline-flex items-center gap-2 font-medium">
            <CreditCard className="size-4 text-muted-foreground" />
            {subscription.billingType}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">Referência</span>
          <span className="font-medium">{subscription.externalReference ?? 'N/A'}</span>
        </div>
      </CardContent>
    </Card>
  );
}
