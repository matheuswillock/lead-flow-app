"use client"

import { useMemo } from "react"
import { BackofficeEmailAnalyticsProvider } from "./features/context/BackofficeEmailAnalyticsContext"
import { BackofficeEmailAnalyticsContainer } from "./features/container/BackofficeEmailAnalyticsContainer"
import { BackofficeEmailAnalyticsService } from "./features/services/BackofficeEmailAnalyticsService"

export default function BackofficeEmailAnalyticsPage() {
  const service = useMemo(() => new BackofficeEmailAnalyticsService(), [])

  return (
    <BackofficeEmailAnalyticsProvider service={service}>
      <BackofficeEmailAnalyticsContainer />
    </BackofficeEmailAnalyticsProvider>
  )
}
