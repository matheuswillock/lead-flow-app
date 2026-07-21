"use client"

import { useContext } from "react"
import { BackofficeEmailAnalyticsContext } from "./BackofficeEmailAnalyticsContext"

export function useBackofficeEmailAnalytics() {
  const ctx = useContext(BackofficeEmailAnalyticsContext)
  if (!ctx) {
    throw new Error(
      "useBackofficeEmailAnalytics must be used within BackofficeEmailAnalyticsProvider"
    )
  }
  return ctx
}
