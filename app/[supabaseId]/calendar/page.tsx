"use client"

import { BoardProvider } from "../board/features/context/BoardContext"
import { SubscriptionGuard } from "@/components/subscription-guard"
import { useUserContext } from "@/app/context/UserContext"
import Calendar42 from "@/components/calendar-42"

export default function CalendarPage() {
  const { hasActiveSubscription, isLoading, userRole } = useUserContext()

  return (
    <BoardProvider>
      <SubscriptionGuard
        hasActiveSubscription={hasActiveSubscription}
        isLoading={isLoading}
        userRole={userRole ?? undefined}
      >
        <Calendar42 />
      </SubscriptionGuard>
    </BoardProvider>
  )
}
