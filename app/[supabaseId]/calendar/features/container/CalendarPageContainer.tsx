"use client";

import { useMemo, useState } from "react";
import { BoardProvider } from "@/app/[supabaseId]/board/features/context/BoardContext";
import { SubscriptionGuard } from "@/components/subscription-guard";
import { useUserContext } from "@/app/context/UserContext";
import { getCalendarWindowFromMonth } from "../utils/calendarHelpers";
import { CalendarContainer } from "./CalendarContainer";

export function CalendarPageContainer() {
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const calendarWindow = useMemo(
    () => getCalendarWindowFromMonth(calendarMonth),
    [calendarMonth]
  );
  const { hasActiveSubscription, isLoading, userRole } = useUserContext();

  return (
    <BoardProvider calendarWindow={calendarWindow}>
      <SubscriptionGuard
        hasActiveSubscription={hasActiveSubscription}
        isLoading={isLoading}
        userRole={userRole ?? undefined}
      >
        <CalendarContainer
          calendarMonth={calendarMonth}
          onCalendarMonthChange={setCalendarMonth}
        />
      </SubscriptionGuard>
    </BoardProvider>
  );
}
