"use client"

import { useContext } from "react"
import { BackofficeCalendarContext } from "./BackofficeCalendarContext"

export function useBackofficeCalendar() {
  const ctx = useContext(BackofficeCalendarContext)
  if (!ctx) {
    throw new Error("useBackofficeCalendar must be used within BackofficeCalendarProvider")
  }
  return ctx
}
