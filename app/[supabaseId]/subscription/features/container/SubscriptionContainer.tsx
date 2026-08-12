'use client';

import { useRouter, useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useSubscriptionContext } from '../context/SubscriptionContext';
import { useFeatureAccess } from '@/app/context/FeatureAccessContext';
import { useTeamContext } from '@/app/context/TeamContext';
import { SubscriptionError } from './SubscriptionError';
import { SubscriptionHeader } from './SubscriptionHeader';
import { SubscriptionInvoices } from './SubscriptionInvoices';
import { SubscriptionSkeleton } from './SubscriptionSkeleton';
import { ReactivateSubscriptionDialog } from './ReactivateSubscriptionDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, Layers, RefreshCw, Settings2, Users } from 'lucide-react';
import { EmailCreditsCard } from './EmailCreditsCard';
import { FEATURE_SLUGS } from '@/lib/features/feature-slugs';
import { isManagerLikeRole } from '@/lib/roles';
import { SubscriptionBillingBreakdownCard } from './SubscriptionBillingBreakdownCard';
import { SubscriptionCreditsDialog } from './SubscriptionCreditsDialog';
import { SubscriptionCustomerCard } from './SubscriptionCustomerCard';
import { SubscriptionDetailsDialog } from './SubscriptionDetailsDialog';
import { SubscriptionHeroCard } from './SubscriptionHeroCard';
import { SubscriptionPeriodCard } from './SubscriptionPeriodCard';
import { SubscriptionPermanentHeroCard } from './SubscriptionPermanentHeroCard';
import { SubscriptionResourceCard } from './SubscriptionResourceCard';
import { shouldShowEmailCreditsTab } from '../utils/emailCreditsTabVisibility';
import { cn } from '@/lib/utils';

export function SubscriptionContainer() {
  const router = useRouter();
  const params = useParams();
  const supabaseId = params.supabaseId as string;
  const [reactivateDialogOpen, setReactivateDialogOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [creditsOpen, setCreditsOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState('resumo');
  
  const {
    subscription,
    invoices,
    isLoading,
    error,
    fetchSubscription,
    fetchInvoices,
    syncSubscription,
    updateCredits
  } = useSubscriptionContext();

  const { hasAccess, isBeta, showsBetaLabel, userRole } = useFeatureAccess();
  const { isTeamMaster, activeRole } = useTeamContext();
  const isPermanentSubscription = subscription?.hasPermanentSubscription === true;

  const showEmailCreditsTab = useMemo(() => {
    const isEmailFeatureBeta =
      isBeta(FEATURE_SLUGS.EMAIL) || isBeta(FEATURE_SLUGS.EMAIL_CAMPAIGNS);
    const canManageSubscription =
      isTeamMaster ||
      userRole.isMaster ||
      isManagerLikeRole(activeRole) ||
      isManagerLikeRole(userRole.role) ||
      // Mantém compatibilidade com o gate anterior quando o usuário já tem acesso ao módulo.
      hasAccess(FEATURE_SLUGS.EMAIL_CAMPAIGNS);

    return shouldShowEmailCreditsTab({
      isEmailFeatureBeta,
      hasRadarBetaAccess: showsBetaLabel(FEATURE_SLUGS.RADAR),
      canManageSubscription,
    });
  }, [activeRole, hasAccess, isBeta, isTeamMaster, showsBetaLabel, userRole.isMaster, userRole.role]);

  const handleReactivate = () => {
    setReactivateDialogOpen(true);
  };

  const handleReactivationSuccess = async () => {
    await fetchSubscription();
    await fetchInvoices();
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await syncSubscription();
    } finally {
      setIsSyncing(false);
    }
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

  if (!subscription) {
    return (
      <div className="flex flex-col gap-6">
        <SubscriptionHeader />
        
        <Card className="mx-auto max-w-2xl">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Nenhuma assinatura ativa</CardTitle>
            <CardDescription>
              Você precisa criar uma assinatura para acessar todas as funcionalidades da plataforma
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
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

  const isCanceled = subscription.status === 'canceled';

  return (
    <div className="flex flex-col gap-6">
      <SubscriptionHeader />

      {isCanceled && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
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
              <RefreshCw data-icon="inline-start" />
              Reativar Assinatura
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col gap-4">
        <TabsList className="h-auto w-full justify-start gap-1.5 rounded-none border-b bg-transparent p-0">
          <TabsTrigger
            value="resumo"
            className={cn(
              "rounded-t-lg rounded-b-none border border-transparent px-3.5 py-2.5 shadow-none",
              "data-[state=active]:border-border data-[state=active]:border-b-background data-[state=active]:bg-card data-[state=active]:shadow-none"
            )}
          >
            Resumo
          </TabsTrigger>
          {showEmailCreditsTab ? (
            <TabsTrigger
              value="creditos-email"
              className={cn(
                "rounded-t-lg rounded-b-none border border-transparent px-3.5 py-2.5 shadow-none",
                "data-[state=active]:border-border data-[state=active]:border-b-background data-[state=active]:bg-card data-[state=active]:shadow-none"
              )}
            >
              Créditos de e-mail
            </TabsTrigger>
          ) : null}
          {!isPermanentSubscription ? (
            <TabsTrigger
              value="faturas"
              className={cn(
                "rounded-t-lg rounded-b-none border border-transparent px-3.5 py-2.5 shadow-none",
                "data-[state=active]:border-border data-[state=active]:border-b-background data-[state=active]:bg-card data-[state=active]:shadow-none"
              )}
            >
              Faturas
            </TabsTrigger>
          ) : null}
        </TabsList>

        <TabsContent value="resumo" className="mt-0 flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {isPermanentSubscription ? (
              <SubscriptionPermanentHeroCard subscription={subscription} onOpenDetails={() => setDetailsOpen(true)} />
            ) : (
              <SubscriptionHeroCard subscription={subscription} onOpenDetails={() => setDetailsOpen(true)} />
            )}

            <SubscriptionResourceCard
              icon={Layers}
              label="Times"
              used={subscription.billingSummary?.usedTeamSlots ?? subscription.billingSummary?.teamCount ?? 0}
              total={isPermanentSubscription ? null : subscription.billingSummary?.totalTeamSlots ?? 1}
              available={subscription.billingSummary?.availableTeamSlots ?? subscription.billingSummary?.availableExtraTeams ?? 0}
              removable={subscription.billingSummary?.removableTeamSlots ?? 0}
              helperText={`1 base + ${subscription.billingSummary?.contractedExtraTeams ?? 0} extras contratados`}
              isPermanent={isPermanentSubscription}
            />

            <SubscriptionResourceCard
              icon={Users}
              label="Usuários"
              used={subscription.billingSummary?.usedUserSlots ?? subscription.billingSummary?.totalUsersIncludingMaster ?? 0}
              total={isPermanentSubscription ? null : subscription.billingSummary?.totalUserSlots ?? 1}
              available={subscription.billingSummary?.availableUserSlots ?? subscription.billingSummary?.availableExtraUsers ?? 0}
              removable={subscription.billingSummary?.removableUserSlots ?? 0}
              helperText={`1 base + ${subscription.billingSummary?.contractedExtraUsers ?? 0} extras contratados`}
              isPermanent={isPermanentSubscription}
            />

            {!isPermanentSubscription && (
              <>
                <SubscriptionPeriodCard subscription={subscription} isSyncing={isSyncing} onSync={handleSync} />
                <SubscriptionBillingBreakdownCard subscription={subscription} />
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Settings2 className="size-5 text-primary" />
                      Créditos
                    </CardTitle>
                    <CardDescription>Adicione ou remova capacidade disponível.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button className="w-full" onClick={() => setCreditsOpen(true)}>
                      Atualizar créditos
                    </Button>
                  </CardContent>
                </Card>
              </>
            )}

            <SubscriptionCustomerCard subscription={subscription} />
          </div>
        </TabsContent>

        {showEmailCreditsTab ? (
          <TabsContent value="creditos-email" className="mt-0">
            <EmailCreditsCard />
          </TabsContent>
        ) : null}

        {!isPermanentSubscription ? (
          <TabsContent value="faturas" className="mt-0">
            <SubscriptionInvoices invoices={invoices} />
          </TabsContent>
        ) : null}
      </Tabs>

      {subscription && (
        <ReactivateSubscriptionDialog
          open={reactivateDialogOpen}
          onOpenChange={setReactivateDialogOpen}
          currentOperatorCount={subscription.planDetails?.operatorCount || 0}
          supabaseId={supabaseId}
          onReactivationSuccess={handleReactivationSuccess}
        />
      )}

      <SubscriptionDetailsDialog
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        subscription={subscription}
      />

      {!isPermanentSubscription && (
        <SubscriptionCreditsDialog
          open={creditsOpen}
          onOpenChange={setCreditsOpen}
          subscription={subscription}
          onUpdateCredits={updateCredits}
        />
      )}
    </div>
  );
}
