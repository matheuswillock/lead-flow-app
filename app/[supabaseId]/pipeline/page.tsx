"use client"

import { PipelineProvider } from "./features/context/PipelineContext";
import { PipelineContainer } from "./features/container/PipelineContainer";
import { SubscriptionGuard } from "@/components/subscription-guard";
import { useUserContext } from "@/app/context/UserContext";

export default function Pipeline() {
  const { hasActiveSubscription, userRole } = useUserContext();
  
  return (
    <PipelineProvider>
      <SubscriptionGuard hasActiveSubscription={hasActiveSubscription} userRole={userRole ?? undefined}>
        <PipelineContainer />
      </SubscriptionGuard>
    </PipelineProvider>
  );
}
