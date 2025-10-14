"use client"

import { BoardProvider } from "./features/context/BoardContext";
import { BoardContainer } from "./features/container/BoardContainer";
import { SubscriptionGuard } from "@/components/subscription-guard";
import { useUserContext } from "@/app/context/UserContext";

export default function BoardPage() {
  const { hasActiveSubscription } = useUserContext();
  
  return (
    <BoardProvider>
      <SubscriptionGuard hasActiveSubscription={hasActiveSubscription}>
        <BoardContainer />
      </SubscriptionGuard>
    </BoardProvider>
  );
}
