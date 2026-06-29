"use client";

import { SubscriptionGuard } from "@/components/subscription-guard";
import { useUserContext } from "@/app/context/UserContext";
import { LeadTransfersProvider } from "./features/context/LeadTransfersContext";
import { LeadTransfersContainer } from "./features/container/LeadTransfersContainer";

export default function LeadTransfersPage() {
  const { hasActiveSubscription, isLoading, userRole } = useUserContext();

  return (
    <LeadTransfersProvider>
      <SubscriptionGuard
        hasActiveSubscription={hasActiveSubscription}
        isLoading={isLoading}
        userRole={userRole ?? undefined}
      >
        <LeadTransfersContainer />
      </SubscriptionGuard>
    </LeadTransfersProvider>
  );
}
