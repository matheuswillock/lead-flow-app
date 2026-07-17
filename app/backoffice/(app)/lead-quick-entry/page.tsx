"use client"

import { useMemo } from "react"
import { BackofficeLeadQuickEntryProvider } from "./features/context/BackofficeLeadQuickEntryContext"
import { BackofficeLeadQuickEntryContainer } from "./features/container/BackofficeLeadQuickEntryContainer"
import { BackofficeLeadQuickEntryService } from "./features/services/BackofficeLeadQuickEntryService"

export default function BackofficeLeadQuickEntryPage() {
  const service = useMemo(() => new BackofficeLeadQuickEntryService(), [])

  return (
    <BackofficeLeadQuickEntryProvider service={service}>
      <BackofficeLeadQuickEntryContainer />
    </BackofficeLeadQuickEntryProvider>
  )
}
