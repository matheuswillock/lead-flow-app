"use client"

import { BoardProvider } from "./features/context/BoardContext";
import { BoardContainer } from "./features/container/BoardContainer";
import { SubscriptionGuard } from "@/components/subscription-guard";
import { useUserContext } from "@/app/context/UserContext";
import { useEffect } from "react";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";

export default function BoardPage() {
  const { hasActiveSubscription, isLoading, userRole } = useUserContext();
  const searchParams = useSearchParams();
  useEffect(() => {
    try {
      const flag = sessionStorage.getItem('subscriptionJustActivated');
      if (flag) {
        sessionStorage.removeItem('subscriptionJustActivated');
        toast.success('Assinatura ativada 🎉', {
          description: 'Bem-vindo(a)! Sua assinatura está ativa. Vamos começar?',
          duration: 5000,
        });
      }
      // Alternativa: bem-vindo via parâmetro após login (fallback quando não havia sessão)
      const welcome = searchParams.get('welcome');
      if (welcome === 'subscribe') {
        toast.success('Assinatura ativada 🎉', {
          description: 'Bem-vindo(a)! Sua assinatura está ativa. Vamos começar?',
          duration: 5000,
        });
        // evitar repetir em navegações subsequentes
        const url = new URL(window.location.href);
        url.searchParams.delete('welcome');
        window.history.replaceState({}, '', url.toString());
      }
    } catch (_) {}
  }, [searchParams]);
  
  return (
    <BoardProvider>
      <SubscriptionGuard hasActiveSubscription={hasActiveSubscription} isLoading={isLoading} userRole={userRole ?? undefined}>
        <BoardContainer />
      </SubscriptionGuard>
    </BoardProvider>
  );
}
