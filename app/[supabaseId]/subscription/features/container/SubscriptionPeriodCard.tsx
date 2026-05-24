'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, RefreshCw } from 'lucide-react';
import type { SubscriptionData } from '../types/subscription.types';
import { formatDate, formatDateTime } from './subscription-format';

interface SubscriptionPeriodCardProps {
  subscription: SubscriptionData;
  isSyncing: boolean;
  onSync: () => Promise<void>;
}

export function SubscriptionPeriodCard({ subscription, isSyncing, onSync }: SubscriptionPeriodCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Calendar className="size-5 text-primary" />
          Período
        </CardTitle>
        <CardDescription>Datas e ciclo de cobrança</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Ciclo</span>
            <span className="font-medium">{subscription.cycleLabel ?? subscription.cycle}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Próximo vencimento</span>
            <span className="text-right font-medium">{formatDate(subscription.nextDueDate)}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Cliente desde</span>
            <span className="text-right font-medium">{formatDate(subscription.subscriptionStartedAt ?? subscription.createdAt)}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Último sync</span>
            <span className="text-right font-medium">{formatDateTime(subscription.lastSyncedAt)}</span>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => void onSync()} disabled={isSyncing}>
          <RefreshCw data-icon="inline-start" />
          {isSyncing ? 'Atualizando...' : 'Atualizar agora'}
        </Button>
      </CardContent>
    </Card>
  );
}
