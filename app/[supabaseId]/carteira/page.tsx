"use client";

import { SubscriptionGuard } from '@/components/subscription-guard';
import { useUserContext } from '@/app/context/UserContext';
import { CarteiraProvider } from './features/context/CarteiraContext';
import { CarteiraContainer } from './features/container/CarteiraContainer';

export default function CarteiraPage() {
  const { hasActiveSubscription, isLoading, userRole } = useUserContext();

  return (
    <CarteiraProvider>
      <SubscriptionGuard
        hasActiveSubscription={hasActiveSubscription}
        isLoading={isLoading}
        userRole={userRole ?? undefined}
      >
        <CarteiraContainer />
      </SubscriptionGuard>
    </CarteiraProvider>
  );
}
