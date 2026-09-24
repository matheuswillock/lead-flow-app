'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { toastUserError } from '@/lib/ui/to-user-toast-message';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import type { SubscriptionData, UpdateSubscriptionCreditsDTO } from '../types/subscription.types';
import { formatCurrency } from './subscription-format';
import { resolveCreditUnitPrice } from '../utils/subscription-billing-breakdown';
import { isCreditQuantityInvalid, parseCreditQuantityInput } from '../utils/subscription-credit-quantity';

interface SubscriptionCreditsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subscription: SubscriptionData;
  onUpdateCredits: (data: UpdateSubscriptionCreditsDTO) => Promise<{ checkoutUrl?: string | null }>;
}

export function SubscriptionCreditsDialog({
  open,
  onOpenChange,
  subscription,
  onUpdateCredits,
}: SubscriptionCreditsDialogProps) {
  const hasUnlimitedUsers = subscription.billingSummary?.hasUnlimitedUsers === true;
  const [action, setAction] = useState<'add' | 'remove'>('add');
  const [resource, setResource] = useState<'user' | 'team'>(hasUnlimitedUsers ? 'team' : 'user');
  const [billingType, setBillingType] = useState<'PIX' | 'CREDIT_CARD'>('PIX');
  const [quantity, setQuantity] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const summary = subscription.billingSummary;
  const maxRemovable = resource === 'team' ? summary?.removableTeamSlots ?? 0 : summary?.removableUserSlots ?? 0;
  // Taxa marginal real do backend: `extraPrice / billableQuantity` é
  // exatamente `BILLING_PRICES.extraTeam`/`extraUser`. Dividir pela
  // quantidade CONTRATADA inflava a estimativa quando o uso real passava dos
  // créditos comprados (achado P1 do Codex no PR #1199).
  const unitPrice = resolveCreditUnitPrice({
    resource,
    billableQuantity: resource === 'team' ? summary?.billableTeams ?? 0 : summary?.billableUsers ?? 0,
    extraPrice: resource === 'team' ? summary?.extraTeamsPrice : summary?.extraUsersPrice,
    onFallback: (kind, fallback) =>
      console.error(
        `[SubscriptionCreditsDialog] billingSummary sem taxa derivável para "${kind}" — usando fallback local ${fallback}`
      ),
  });
  const quantityIsInvalid = isCreditQuantityInvalid({ quantity, action, maxRemovable });

  const impactText = useMemo(() => {
    if (hasUnlimitedUsers && resource === 'user') {
      return 'Plano anual com usuários ilimitados: não é necessário gerenciar créditos de usuários.';
    }
    if (!Number.isInteger(quantity)) {
      return 'Informe uma quantidade válida.';
    }
    const label = resource === 'team' ? 'times' : 'usuários';
    if (action === 'remove') {
      return `Reduz ${quantity} créditos de ${label} da capacidade futura.`;
    }
    return `Adiciona ${quantity} créditos de ${label} sem criar ${resource === 'team' ? 'time' : 'usuário'} agora.`;
  }, [action, hasUnlimitedUsers, quantity, resource]);

  const handleSubmit = async () => {
    if (quantityIsInvalid) return;
    setIsSubmitting(true);
    try {
      const result = await onUpdateCredits({ action, resource, quantity, billingType });
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
        return;
      }
      toast.success('Créditos atualizados com sucesso');
      onOpenChange(false);
    } catch (error) {
      toastUserError(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] sm:max-w-xl flex flex-col">
        <DialogHeader>
          <DialogTitle>Atualizar créditos</DialogTitle>
          <DialogDescription>Adicione capacidade via checkout ou remova apenas créditos não utilizados.</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto pr-1">
          <div className="flex flex-col gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label>Ação</Label>
                <Select value={action} onValueChange={(value) => setAction(value as 'add' | 'remove')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="add">Adicionar créditos</SelectItem>
                      <SelectItem value="remove">Remover créditos</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Tipo</Label>
                <Select value={resource} onValueChange={(value) => setResource(value as 'user' | 'team')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {!hasUnlimitedUsers && <SelectItem value="user">Usuários</SelectItem>}
                      <SelectItem value="team">Times</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="subscription-credit-quantity">Quantidade</Label>
                <Input
                  id="subscription-credit-quantity"
                  type="number"
                  min={1}
                  max={action === 'remove' ? maxRemovable : undefined}
                  value={Number.isNaN(quantity) ? '' : quantity}
                  onChange={(event) => setQuantity(parseCreditQuantityInput(event.target.value))}
                  aria-invalid={quantityIsInvalid}
                />
              </div>
              {action === 'add' && (
                <div className="flex flex-col gap-2">
                  <Label>Pagamento</Label>
                  <Select value={billingType} onValueChange={(value) => setBillingType(value as 'PIX' | 'CREDIT_CARD')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="PIX">PIX</SelectItem>
                        <SelectItem value="CREDIT_CARD">Cartão de crédito</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            {action === 'remove' && (
              <p className="text-sm text-muted-foreground">Máximo removível agora: {maxRemovable}</p>
            )}
            <Separator />
            <div className="rounded-md border bg-surface-1 p-4 text-sm">
              <div className="flex flex-col gap-2">
                <span className="font-medium">{impactText}</span>
                {action === 'add' && Number.isInteger(quantity) && (
                  <span className="text-muted-foreground">
                    Impacto mensal estimado: {formatCurrency(quantity * unitPrice)}
                  </span>
                )}
                {quantityIsInvalid && (
                  <span className="text-semantic-danger">Quantidade inválida para a capacidade disponível.</span>
                )}
                {hasUnlimitedUsers && resource === 'team' && (
                  <span className="text-muted-foreground">Usuários já são ilimitados neste plano anual.</span>
                )}
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" className="max-lg:h-11" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button className="max-lg:h-11" onClick={() => void handleSubmit()} disabled={isSubmitting || quantityIsInvalid}>
            {isSubmitting ? 'Processando...' : action === 'add' ? 'Ir para checkout' : 'Remover créditos'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
