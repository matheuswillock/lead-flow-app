"use client";

import { SubscriptionGuard } from '@/components/subscription-guard';
import { useUserContext } from '@/app/context/UserContext';
import { PerformanceProvider } from './features/context/PerformanceContext';
import { PerformanceContainer } from './features/container/PerformanceContainer';

export default function PerformancePage() {
  const { hasActiveSubscription, isLoading, userRole } = useUserContext();

  return (
    <PerformanceProvider>
      <SubscriptionGuard
        hasActiveSubscription={hasActiveSubscription}
        isLoading={isLoading}
        userRole={userRole ?? undefined}
      >
        <PerformanceContainer />
      </SubscriptionGuard>
    </PerformanceProvider>
  );
}
