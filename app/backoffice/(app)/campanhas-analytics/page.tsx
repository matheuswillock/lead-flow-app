"use client"

import { useMemo } from "react"
import { CampanhasAnalyticsProvider } from "./features/context/CampanhasAnalyticsContext"
import { CampanhasAnalyticsContainer } from "./features/container/CampanhasAnalyticsContainer"
import { CampanhasAnalyticsService } from "./features/services/CampanhasAnalyticsService"

export default function CampanhasAnalyticsPage() {
  const service = useMemo(() => new CampanhasAnalyticsService(), [])

  return (
    <CampanhasAnalyticsProvider service={service}>
      <CampanhasAnalyticsContainer />
    </CampanhasAnalyticsProvider>
  )
}
