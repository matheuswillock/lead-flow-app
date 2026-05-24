'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CreditCard, FileText } from 'lucide-react';
import type { SubscriptionData } from '../types/subscription.types';
import { formatCurrency } from './subscription-format';

interface SubscriptionHeroCardProps {
  subscription: SubscriptionData;
  onOpenDetails: () => void;
}

const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
  trial: { label: 'Trial', variant: 'secondary' },
  active: { label: 'Ativa', variant: 'default' },
  past_due: { label: 'Atrasada', variant: 'destructive' },
  suspended: { label: 'Suspensa', variant: 'destructive' },
  canceled: { label: 'Cancelada', variant: 'secondary' },
};

export function SubscriptionHeroCard({ subscription, onOpenDetails }: SubscriptionHeroCardProps) {
  const status = statusLabels[subscription.status] ?? { label: subscription.status, variant: 'default' as const };

  return (
    <Card className="md:col-span-2 xl:col-span-2 overflow-hidden">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Badge variant={status.variant} className="w-fit">
            {status.label}
          </Badge>
          <div className="flex flex-col gap-1">
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="size-5 text-primary" />
              {subscription.description}
            </CardTitle>
            <CardDescription>Assinatura e capacidade contratada da conta</CardDescription>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onOpenDetails}>
          <FileText data-icon="inline-start" />
          Detalhes
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="text-4xl font-bold text-primary">{formatCurrency(subscription.value)}</div>
        <p className="text-sm text-muted-foreground">por {subscription.cycleLabel?.toLowerCase() ?? 'mensal'}</p>
      </CardContent>
    </Card>
  );
}
