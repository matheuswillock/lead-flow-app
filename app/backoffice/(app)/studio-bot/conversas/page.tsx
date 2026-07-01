"use client"

import { useMemo } from "react"
import { BackofficeStudioBotProvider } from "../features/context/BackofficeStudioBotContext"
import { BackofficeStudioBotConversasContainer } from "../features/container/BackofficeStudioBotConversasContainer"
import { BackofficeStudioBotService } from "../features/services/BackofficeStudioBotService"

export default function BackofficeStudioBotConversasPage() {
  const service = useMemo(() => new BackofficeStudioBotService(), [])

  return (
    <BackofficeStudioBotProvider service={service}>
      <BackofficeStudioBotConversasContainer />
    </BackofficeStudioBotProvider>
  )
}
