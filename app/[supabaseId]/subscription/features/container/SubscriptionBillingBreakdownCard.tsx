'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Receipt } from 'lucide-react';
import type { SubscriptionData } from '../types/subscription.types';
import { formatCurrency } from './subscription-format';
import { resolveExtraUnitPrice } from '../utils/subscription-billing-breakdown';

interface SubscriptionBillingBreakdownCardProps {
  subscription: SubscriptionData;
}

/**
 * DA4: preço exibido vem do backend (`billingSummary`); a constante local é
 * só um último fallback logado — nunca a fonte silenciosa de divergência com
 * o que o Asaas efetivamente cobra ([[01 — Auditoria]] §3.1).
 */
function logMissingBillingSummary(field: string, value: number): number {
  console.error(
    `[SubscriptionBillingBreakdownCard] billingSummary sem dado para "${field}" — usando fallback local ${value}`
  );
  return value;
}

export function SubscriptionBillingBreakdownCard({ subscription }: SubscriptionBillingBreakdownCardProps) {
  const summary = subscription.billingSummary;
  const hasUnlimitedUsers = summary?.hasUnlimitedUsers === true;

  // A linha detalha a COBRANÇA, então o multiplicando é a quantidade
  // faturável — a mesma que o backend usa para calcular `extraTeamsPrice`
  // (`billableTeams * BILLING_PRICES.extraTeam`). Usar a contratada aqui
  // quebrava a aritmética do rótulo sempre que o uso real passava dos
  // créditos comprados (achado P1 do Codex no PR #1199).
  const billableTeams = summary?.billableTeams ?? 0;
  const billableUsers = summary?.billableUsers ?? 0;

  const extraTeamUnitPrice = resolveExtraUnitPrice({
    billableQuantity: billableTeams,
    extraPrice: summary?.extraTeamsPrice,
    fallback: 29.9,
    onFallback: (fallback) => logMissingBillingSummary('extraTeamUnitPrice', fallback),
  });
  const extraUserUnitPrice = resolveExtraUnitPrice({
    billableQuantity: billableUsers,
    extraPrice: summary?.extraUsersPrice,
    fallback: 19.9,
    onFallback: (fallback) => logMissingBillingSummary('extraUserUnitPrice', fallback),
  });

  const basePrice = summary?.basePrice ?? logMissingBillingSummary('basePrice', 59.9);

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
          <span className="font-medium">{formatCurrency(basePrice)}</span>
        </div>
        {billableTeams > 0 && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">
              Times adicionais ({billableTeams} × {formatCurrency(extraTeamUnitPrice)})
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
        {!hasUnlimitedUsers && billableUsers > 0 && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">
              Usuários adicionais ({billableUsers} × {formatCurrency(extraUserUnitPrice)})
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
