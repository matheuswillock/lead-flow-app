"use client"

import { useMemo } from "react"
import { BackofficeCalendarProvider } from "./features/context/BackofficeCalendarContext"
import { BackofficeCalendarService } from "./features/services/BackofficeCalendarService"
import { BackofficeCalendarContainer } from "./features/container/BackofficeCalendarContainer"

export default function BackofficeCalendarPage() {
  const service = useMemo(() => new BackofficeCalendarService(), [])

  return (
    <BackofficeCalendarProvider service={service}>
      <BackofficeCalendarContainer />
    </BackofficeCalendarProvider>
  )
}
