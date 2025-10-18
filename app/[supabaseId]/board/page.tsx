"use client"

import { BoardProvider } from "./features/context/BoardContext";
import { BoardContainer } from "./features/container/BoardContainer";
import { SubscriptionGuard } from "@/components/subscription-guard";
import { useUserContext } from "@/app/context/UserContext";
import { useEffect } from "react";
import { toast } from "sonner";

export default function BoardPage() {
  const { hasActiveSubscription } = useUserContext();
  useEffect(() => {
    try {
      const flag = sessionStorage.getItem('subscriptionJustActivated');
      if (flag) {
        sessionStorage.removeItem('subscriptionJustActivated');
        toast.success('Bem-vindo(a)!', {
          description: 'Sua assinatura foi ativada com sucesso. Bom trabalho!'
        });
      }
    } catch (_) {}
  }, []);
  
  return (
    <BoardProvider>
      <SubscriptionGuard hasActiveSubscription={hasActiveSubscription}>
        <BoardContainer />
      </SubscriptionGuard>
    </BoardProvider>
  );
}
