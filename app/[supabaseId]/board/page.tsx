"use client"

import { BoardProvider } from "./features/context/BoardContext";
import { BoardContainer } from "./features/container/BoardContainer";
import { SubscriptionGuard } from "@/components/subscription-guard";
import { useUserContext } from "@/app/context/UserContext";
import { useEffect } from "react";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";

export default function BoardPage() {
  const { hasActiveSubscription } = useUserContext();
  const searchParams = useSearchParams();
  useEffect(() => {
    try {
      const flag = sessionStorage.getItem('subscriptionJustActivated');
      if (flag) {
        sessionStorage.removeItem('subscriptionJustActivated');
        toast.success('Bem-vindo(a)!', {
          description: 'Sua assinatura foi ativada com sucesso. Bom trabalho!'
        });
      }
      // Alternativa: bem-vindo via parâmetro após login (fallback quando não havia sessão)
      const welcome = searchParams.get('welcome');
      if (welcome === 'subscribe') {
        toast.success('Bem-vindo(a)!', {
          description: 'Sua assinatura foi confirmada. Vamos começar?'
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
      <SubscriptionGuard hasActiveSubscription={hasActiveSubscription}>
        <BoardContainer />
      </SubscriptionGuard>
    </BoardProvider>
  );
}
