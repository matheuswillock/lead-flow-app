"use client"

import { PipelineProvider } from "./features/context/PipelineContext";
import { PipelineContainer } from "./features/container/PipelineContainer";
import { SubscriptionGuard } from "@/components/subscription-guard";
import { useUserContext } from "@/app/context/UserContext";

export default function Pipeline() {
  const { hasActiveSubscription } = useUserContext();
  
  return (
    <PipelineProvider>
      <SubscriptionGuard hasActiveSubscription={hasActiveSubscription}>
        <PipelineContainer />
      </SubscriptionGuard>
    </PipelineProvider>
  );
}
