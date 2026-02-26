"use client"

import { BoardProvider } from "../board/features/context/BoardContext"
import { SubscriptionGuard } from "@/components/subscription-guard"
import { useUserContext } from "@/app/context/UserContext"
import CalendarStudio from "@/components/calendar-studio"

export default function CalendarPage() {
  const { hasActiveSubscription, isLoading, userRole } = useUserContext()

  return (
    <BoardProvider>
      <SubscriptionGuard
        hasActiveSubscription={hasActiveSubscription}
        isLoading={isLoading}
        userRole={userRole ?? undefined}
      >
        <CalendarStudio />
      </SubscriptionGuard>
    </BoardProvider>
  )
}
