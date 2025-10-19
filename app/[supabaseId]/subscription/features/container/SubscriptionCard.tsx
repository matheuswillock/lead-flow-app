'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, CreditCard, Users, AlertCircle } from 'lucide-react';
import type { SubscriptionData } from '../types/subscription.types';
import { toast } from 'sonner';

interface SubscriptionCardProps {
  subscription: SubscriptionData;
  onCancel: () => Promise<void>;
}

export function SubscriptionCard({ subscription, onCancel }: SubscriptionCardProps) {
  
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
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const handleCancel = async () => {
    if (confirm('Tem certeza que deseja cancelar sua assinatura?')) {
      try {
        await onCancel();
        toast.success('Assinatura cancelada com sucesso');
      } catch (error) {
        toast.error('Erro ao cancelar assinatura');
      }
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
              <span className="text-muted-foreground">Valor Mensal:</span>
              <span className="font-semibold">{formatCurrency(subscription.value)}</span>
            </div>
            
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Próximo Vencimento:</span>
              <span className="font-semibold">{formatDate(subscription.nextDueDate)}</span>
            </div>

            {subscription.planDetails?.operatorCount !== undefined && (
              <div className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Operadores:</span>
                <span className="font-semibold">{subscription.planDetails.operatorCount}</span>
              </div>
            )}
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
          <Button variant="outline" size="sm">
            Atualizar Método de Pagamento
          </Button>
          {subscription.status !== 'canceled' && (
            <Button 
              variant="destructive" 
              size="sm"
              onClick={handleCancel}
            >
              Cancelar Assinatura
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
