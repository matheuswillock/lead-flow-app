'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CreditCard, UserRound } from 'lucide-react';
import type { SubscriptionData } from '../types/subscription.types';
import { formatBillingType } from './subscription-format';

interface SubscriptionCustomerCardProps {
  subscription: SubscriptionData;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="break-words font-medium">{children}</span>
    </div>
  );
}

/**
 * Responsável pela assinatura. Na vitalícia é o único card da 2ª linha, então ocupa a linha
 * inteira e mostra os campos lado a lado; não há cobrança, logo método e referência somem.
 * Na paga ele fecha a 4ª coluna ao lado de período, composição e créditos.
 */
export function SubscriptionCustomerCard({ subscription }: SubscriptionCustomerCardProps) {
  const isPermanent = subscription.hasPermanentSubscription === true;

  return (
    <Card className={isPermanent ? 'md:col-span-2 xl:col-span-4' : undefined}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <UserRound className="size-5 text-primary" />
          Cliente
        </CardTitle>
        <CardDescription>Dados do responsável pela assinatura</CardDescription>
      </CardHeader>
      <CardContent className={isPermanent ? 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3' : 'flex flex-col gap-4'}>
        <Field label="Nome">{subscription.customer.name}</Field>
        <Field label="E-mail">{subscription.customer.email}</Field>
        {isPermanent ? (
          <Field label="Cobrança">Sem cobrança</Field>
        ) : (
          <>
            <Field label="Método">
              <span className="inline-flex items-center gap-2">
                <CreditCard className="size-4 text-muted-foreground" aria-hidden />
                {formatBillingType(subscription.billingType)}
              </span>
            </Field>
            <Field label="Referência">{subscription.externalReference ?? 'N/A'}</Field>
          </>
        )}
      </CardContent>
    </Card>
  );
}
