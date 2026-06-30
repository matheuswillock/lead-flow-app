"use client"

import { useMemo } from "react"
import { BackofficeStudioBotProvider } from "./features/context/BackofficeStudioBotContext"
import { BackofficeStudioBotOverviewContainer } from "./features/container/BackofficeStudioBotOverviewContainer"
import { BackofficeStudioBotService } from "./features/services/BackofficeStudioBotService"

export default function BackofficeStudioBotPage() {
  const service = useMemo(() => new BackofficeStudioBotService(), [])

  return (
    <BackofficeStudioBotProvider service={service}>
      <BackofficeStudioBotOverviewContainer />
    </BackofficeStudioBotProvider>
  )
}
