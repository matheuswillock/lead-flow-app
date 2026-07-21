"use client";

import { SubscriptionGuard } from '@/components/subscription-guard';
import { useUserContext } from '@/app/context/UserContext';
import { MeetingsHeldProvider } from './features/context/MeetingsHeldContext';
import { MeetingsHeldContainer } from './features/container/MeetingsHeldContainer';

export default function ReunioesRealizadasPage() {
  const { hasActiveSubscription, isLoading, userRole } = useUserContext();

  return (
    <MeetingsHeldProvider>
      <SubscriptionGuard
        hasActiveSubscription={hasActiveSubscription}
        isLoading={isLoading}
        userRole={userRole ?? undefined}
      >
        <MeetingsHeldContainer />
      </SubscriptionGuard>
    </MeetingsHeldProvider>
  );
}
