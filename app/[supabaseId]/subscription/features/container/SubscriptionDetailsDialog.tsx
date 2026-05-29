'use client';

import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import type { SubscriptionData } from '../types/subscription.types';
import { formatCurrency, formatDate } from './subscription-format';

interface SubscriptionDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subscription: SubscriptionData;
}

export function SubscriptionDetailsDialog({ open, onOpenChange, subscription }: SubscriptionDetailsDialogProps) {
  const summary = subscription.billingSummary;
  const isPermanent = subscription.hasPermanentSubscription;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] sm:max-w-2xl flex flex-col">
        <DialogHeader>
          <DialogTitle>Detalhes da assinatura</DialogTitle>
          <DialogDescription>Plano, quantidades contratadas e capacidade disponível.</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto pr-1">
          <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-sm text-muted-foreground">Plano</span>
                <span className="font-semibold">{subscription.description}</span>
              </div>
              <Badge variant={isPermanent ? 'default' : 'secondary'}>
                {isPermanent ? 'Vitalícia' : subscription.status}
              </Badge>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <DetailItem label="Ciclo" value={subscription.cycleLabel ?? subscription.cycle} />
              <DetailItem label="Próximo vencimento" value={formatDate(subscription.nextDueDate)} />
              <DetailItem label="Cliente desde" value={formatDate(subscription.subscriptionStartedAt ?? subscription.createdAt)} />
              <DetailItem label="Valor atual" value={isPermanent ? 'Sem cobrança' : formatCurrency(subscription.value)} />
            </div>
            <Separator />
            <div className="grid gap-4 md:grid-cols-2">
              <DetailItem label="Base inclusa" value="1 time + 1 usuário" />
              <DetailItem label="Método de pagamento" value={subscription.billingType} />
              <DetailItem
                label="Créditos extras de times"
                value={isPermanent ? 'Ilimitado' : String(summary?.contractedExtraTeams ?? 0)}
              />
              <DetailItem
                label="Créditos extras de usuários"
                value={isPermanent ? 'Ilimitado' : String(summary?.contractedExtraUsers ?? 0)}
              />
              <DetailItem label="Times em uso" value={String(summary?.usedTeamSlots ?? 0)} />
              <DetailItem label="Usuários em uso" value={String(summary?.usedUserSlots ?? 0)} />
              <DetailItem
                label="Times disponíveis"
                value={isPermanent ? 'Ilimitado' : String(summary?.availableTeamSlots ?? 0)}
              />
              <DetailItem
                label="Usuários disponíveis"
                value={isPermanent ? 'Ilimitado' : String(summary?.availableUserSlots ?? 0)}
              />
              {!isPermanent && <DetailItem label="Times removíveis" value={String(summary?.removableTeamSlots ?? 0)} />}
              {!isPermanent && <DetailItem label="Usuários removíveis" value={String(summary?.removableUserSlots ?? 0)} />}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border bg-surface-1 p-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
