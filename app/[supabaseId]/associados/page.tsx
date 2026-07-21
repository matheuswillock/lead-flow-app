'use client';

import { SubscriptionGuard } from "@/components/subscription-guard";
import { useUserContext } from "@/app/context/UserContext";
import { AssociadosProvider } from "./features/context/AssociadosContext";
import { AssociadosContainer } from "./features/container/AssociadosContainer";

export default function AssociadosPage() {
  const { hasActiveSubscription, isLoading, userRole } = useUserContext();

  return (
    <AssociadosProvider>
      <SubscriptionGuard
        hasActiveSubscription={hasActiveSubscription}
        isLoading={isLoading}
        userRole={userRole ?? undefined}
      >
        <AssociadosContainer />
      </SubscriptionGuard>
    </AssociadosProvider>
  );
}
