"use client";

import { use } from "react";
import { ManagerUsersContainer } from "./features/container/ManagerUsersContainer";
import { Skeleton } from "@/components/ui/skeleton";
import { SubscriptionGuard } from "@/components/subscription-guard";
import { useUserContext } from "@/app/context/UserContext";

interface ManagerUsersPageProps {
  params: Promise<{
    supabaseId: string;
  }>;
}

function ManagerUsersPageContent({ supabaseId }: { supabaseId: string }) {
  const { user, isLoading, hasActiveSubscription } = useUserContext();

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 px-6 space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <SubscriptionGuard hasActiveSubscription={hasActiveSubscription}>
      <ManagerUsersContainer 
        supabaseId={supabaseId}
        currentUserRole={user?.role || "operator"}
      />
    </SubscriptionGuard>
  );
}

export default function ManagerUsersPage({ params }: ManagerUsersPageProps) {
  const { supabaseId } = use(params);

  return <ManagerUsersPageContent supabaseId={supabaseId} />;
}