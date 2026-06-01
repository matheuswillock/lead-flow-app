'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Receipt } from 'lucide-react';
import type { SubscriptionData } from '../types/subscription.types';
import { formatCurrency } from './subscription-format';

interface SubscriptionBillingBreakdownCardProps {
  subscription: SubscriptionData;
}

export function SubscriptionBillingBreakdownCard({ subscription }: SubscriptionBillingBreakdownCardProps) {
  const summary = subscription.billingSummary;
  const extraTeamUnitPrice = summary?.contractedExtraTeams ? summary.extraTeamsPrice / summary.billableTeams : 29.9;
  const extraUserUnitPrice = summary?.contractedExtraUsers ? summary.extraUsersPrice / summary.billableUsers : 19.9;
  const hasUnlimitedUsers = summary?.hasUnlimitedUsers === true;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Receipt className="size-5 text-primary" />
          Cobrança
        </CardTitle>
        <CardDescription>Composição recorrente atual</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Base (1 time + 1 usuário)</span>
          <span className="font-medium">{formatCurrency(summary?.basePrice ?? 59.9)}</span>
        </div>
        {(summary?.contractedExtraTeams ?? 0) > 0 && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">
              Times adicionais ({summary?.contractedExtraTeams} × {formatCurrency(extraTeamUnitPrice)})
            </span>
            <span className="font-medium">{formatCurrency(summary?.extraTeamsPrice)}</span>
          </div>
        )}
        {hasUnlimitedUsers && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Usuários adicionais</span>
            <span className="font-medium">Ilimitados</span>
          </div>
        )}
        {!hasUnlimitedUsers && (summary?.contractedExtraUsers ?? 0) > 0 && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">
              Usuários adicionais ({summary?.contractedExtraUsers} × {formatCurrency(extraUserUnitPrice)})
            </span>
            <span className="font-medium">{formatCurrency(summary?.extraUsersPrice)}</span>
          </div>
        )}
        <Separator />
        <div className="flex items-center justify-between gap-3">
          <span className="font-semibold">Total mensal</span>
          <span className="text-lg font-bold text-primary">{formatCurrency(summary?.totalPrice ?? subscription.value)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
