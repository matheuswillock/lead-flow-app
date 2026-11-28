"use client"

import { BackofficeBethaniaProvider } from "./features/bethania/BackofficeBethaniaContext"
import { BackofficeBethaniaOverview } from "./features/bethania/BackofficeBethaniaOverview"

export default function BackofficeStudioBotPage() {
  return (
    <BackofficeBethaniaProvider>
      <BackofficeBethaniaOverview />
    </BackofficeBethaniaProvider>
  )
}
