"use client"

import { BackofficeDashboardProvider } from "@/app/backoffice/features/context/BackofficeDashboardContext"
import { BackofficeDashboardContainer } from "@/app/backoffice/features/container/BackofficeDashboardContainer"
import { BackofficeDashboardService } from "@/app/backoffice/features/services/BackofficeDashboardService"

const dashboardService = new BackofficeDashboardService()

export default function BackofficeDashboardPage() {
  return (
    <BackofficeDashboardProvider dashboardService={dashboardService}>
      <BackofficeDashboardContainer />
    </BackofficeDashboardProvider>
  )
}
