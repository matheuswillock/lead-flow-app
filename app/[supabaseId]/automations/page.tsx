"use client";

import { SubscriptionGuard } from "@/components/subscription-guard";
import { useUserContext } from "@/app/context/UserContext";
import { AutomationsProvider } from "./features/context/AutomationsContext";
import { AutomationsContainer } from "./features/container/AutomationsContainer";

export default function AutomationsPage() {
  const { hasActiveSubscription, isLoading, userRole } = useUserContext();

  return (
    <AutomationsProvider>
      <SubscriptionGuard
        hasActiveSubscription={hasActiveSubscription}
        isLoading={isLoading}
        userRole={userRole ?? undefined}
      >
        <AutomationsContainer />
      </SubscriptionGuard>
    </AutomationsProvider>
  );
}
