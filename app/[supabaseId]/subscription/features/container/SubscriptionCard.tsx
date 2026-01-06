'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Calendar, CreditCard, Users, AlertCircle } from 'lucide-react';
import type { SubscriptionData } from '../types/subscription.types';
import { toast } from 'sonner';
import { useState } from 'react';

interface SubscriptionCardProps {
  subscription: SubscriptionData;
  onCancel: () => Promise<void>;
}

export function SubscriptionCard({ subscription, onCancel }: SubscriptionCardProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  
  const getStatusBadge = (status: string) => {
    const statusMap = {
      trial: { label: 'Período de Teste', variant: 'default' as const },
      active: { label: 'Ativa', variant: 'default' as const },
      past_due: { label: 'Pagamento Atrasado', variant: 'destructive' as const },
      suspended: { label: 'Suspensa', variant: 'destructive' as const },
      canceled: { label: 'Cancelada', variant: 'secondary' as const }
    };

    const statusInfo = statusMap[status as keyof typeof statusMap] || { label: status, variant: 'default' as const };
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    return `${day} de ${month} de ${year}`;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  // Calcular breakdown do preço
  const calculatePriceBreakdown = () => {
    const basePrice = 59.90;
    const operatorPrice = 19.90;
    const operatorCount = subscription.planDetails?.operatorCount || 0;
    
    return {
      basePrice,
      operatorPrice,
      operatorCount,
      operatorTotal: operatorCount * operatorPrice,
      total: basePrice + (operatorCount * operatorPrice)
    };
  };

  const priceBreakdown = calculatePriceBreakdown();

  const handleCancel = async () => {
    setIsCanceling(true);
    try {
      await onCancel();
      toast.success('Assinatura cancelada com sucesso');
      setIsDialogOpen(false);
    } catch (error) {
      toast.error('Erro ao cancelar assinatura');
    } finally {
      setIsCanceling(false);
    }
  };

  return (
    <Card className="col-span-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Sua Assinatura
            </CardTitle>
            <CardDescription>{subscription.description}</CardDescription>
          </div>
          {getStatusBadge(subscription.status)}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Informações da Assinatura */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Plano Manager Base:</span>
              <span className="font-semibold">{formatCurrency(priceBreakdown.basePrice)}</span>
            </div>

            {priceBreakdown.operatorCount > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {priceBreakdown.operatorCount} Operador{priceBreakdown.operatorCount > 1 ? 'es' : ''} × {formatCurrency(priceBreakdown.operatorPrice)}:
                </span>
                <span className="font-semibold">{formatCurrency(priceBreakdown.operatorTotal)}</span>
              </div>
            )}

            <div className="flex items-center gap-2 text-sm pt-2 border-t">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Valor Mensal Total:</span>
              <span className="font-bold text-lg">{formatCurrency(priceBreakdown.total)}</span>
            </div>
            
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Próximo Vencimento:</span>
              <span className="font-semibold">{formatDate(subscription.nextDueDate)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Cliente:</span>
              <span className="font-semibold">{subscription.customer.name}</span>
            </div>
            
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Email:</span>
              <span className="font-semibold">{subscription.customer.email}</span>
            </div>

            {subscription.planDetails?.trialEndDate && (
              <div className="flex items-center gap-2 text-sm">
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Fim do Trial:</span>
                <span className="font-semibold">{formatDate(subscription.planDetails.trialEndDate)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Ações */}
        <div className="flex gap-2 pt-4 border-t">
          {/* <Button variant="outline" size="sm">
            Atualizar Método de Pagamento
          </Button> */}
          {subscription.status !== 'canceled' && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive" className="cursor-pointer" size="sm">
                  Cancelar Assinatura
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Cancelar Assinatura</DialogTitle>
                  <DialogDescription>
                    Tem certeza que deseja cancelar sua assinatura?
                    <br />
                    <br />
                    Ao cancelar, você perderá acesso aos recursos premium e seus operadores não poderão mais usar o sistema.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                    disabled={isCanceling}
                    className="cursor-pointer"
                  >
                    Voltar
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleCancel}
                    disabled={isCanceling}
                    className="cursor-pointer"
                  >
                    {isCanceling ? 'Cancelando...' : 'Confirmar Cancelamento'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
