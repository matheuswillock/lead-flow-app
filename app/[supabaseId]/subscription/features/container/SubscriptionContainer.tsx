'use client';

import { useRouter, useParams } from 'next/navigation';
import { useState } from 'react';
import { useSubscriptionContext } from '../context/SubscriptionContext';
import { SubscriptionCard } from './SubscriptionCard';
import { SubscriptionError } from './SubscriptionError';
import { SubscriptionHeader } from './SubscriptionHeader';
import { SubscriptionInvoices } from './SubscriptionInvoices';
import { SubscriptionSkeleton } from './SubscriptionSkeleton';
import { ReactivateSubscriptionDialog } from './ReactivateSubscriptionDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, RefreshCw } from 'lucide-react';

export function SubscriptionContainer() {
  const router = useRouter();
  const params = useParams();
  const supabaseId = params.supabaseId as string;
  const [reactivateDialogOpen, setReactivateDialogOpen] = useState(false);
  
  const {
    subscription,
    invoices,
    isLoading,
    error,
    fetchSubscription,
    fetchInvoices,
    cancelSubscription
  } = useSubscriptionContext();

  const handleReactivate = () => {
    setReactivateDialogOpen(true);
  };

  const handleReactivationSuccess = async () => {
    await fetchSubscription();
    await fetchInvoices();
  };

  if (isLoading && !subscription) {
    return <SubscriptionSkeleton />;
  }

  if (error) {
    return (
      <SubscriptionError 
        error={error} 
        onRetry={() => {
          fetchSubscription();
          fetchInvoices();
        }} 
      />
    );
  }

  // Se não houver assinatura, mostrar card para criar
  if (!subscription) {
    return (
      <div className="space-y-6">
        <SubscriptionHeader />
        
        <Card className="max-w-2xl mx-auto">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Nenhuma assinatura ativa</CardTitle>
            <CardDescription>
              Você precisa criar uma assinatura para acessar todas as funcionalidades da plataforma
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center space-y-4">
            <p className="text-center text-muted-foreground">
              Crie sua assinatura agora e comece a gerenciar seus leads com eficiência
            </p>
            <Button 
              size="lg"
              onClick={() => router.push(`/${supabaseId}/account`)}
            >
              Ir para Minha Conta
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Se assinatura está cancelada, mostrar alerta e botão de reativar
  const isCanceled = subscription.status === 'canceled';

  return (
    <div className="space-y-6">
      <SubscriptionHeader />

      {isCanceled && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Assinatura Cancelada</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>
              Sua assinatura foi cancelada. Reative para continuar usando a plataforma.
            </span>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleReactivate}
              className="ml-4"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Reativar Assinatura
            </Button>
          </AlertDescription>
        </Alert>
      )}
      
      <div className="grid gap-6 md:grid-cols-2">
        <SubscriptionCard 
          subscription={subscription}
          onCancel={cancelSubscription}
        />
      </div>

      <SubscriptionInvoices invoices={invoices} />

      {/* Dialog de reativação */}
      {subscription && (
        <ReactivateSubscriptionDialog
          open={reactivateDialogOpen}
          onOpenChange={setReactivateDialogOpen}
          currentOperatorCount={subscription.planDetails?.operatorCount || 0}
          supabaseId={supabaseId}
          onReactivationSuccess={handleReactivationSuccess}
        />
      )}
    </div>
  );
}
