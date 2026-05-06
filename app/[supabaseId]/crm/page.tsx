"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { SubscriptionGuard } from "@/components/subscription-guard";
import { useUserContext } from "@/app/context/UserContext";
import { CrmProvider } from "./features/context/CrmContext";
import { CrmContainer } from "./features/container/CrmContainer";

export default function CrmPage() {
  const { hasActiveSubscription, isLoading, userRole } = useUserContext();
  const searchParams = useSearchParams();

  useEffect(() => {
    try {
      const flag = sessionStorage.getItem("subscriptionJustActivated");
      if (flag) {
        sessionStorage.removeItem("subscriptionJustActivated");
        toast.success("Assinatura ativada 🎉", {
          description: "Bem-vindo(a)! Sua assinatura está ativa. Vamos começar?",
          duration: 5000,
        });
      }

      // legacy subscribe onboarding removed
    } catch (_) {}
  }, [searchParams]);

  return (
    <CrmProvider>
      <SubscriptionGuard
        hasActiveSubscription={hasActiveSubscription}
        isLoading={isLoading}
        userRole={userRole ?? undefined}
      >
        <CrmContainer />
      </SubscriptionGuard>
    </CrmProvider>
  );
}
