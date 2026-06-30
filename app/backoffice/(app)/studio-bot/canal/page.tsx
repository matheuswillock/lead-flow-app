"use client"

import { useMemo } from "react"
import { BackofficeStudioBotProvider } from "../features/context/BackofficeStudioBotContext"
import { BackofficeStudioBotCanalContainer } from "../features/container/BackofficeStudioBotCanalContainer"
import { BackofficeStudioBotService } from "../features/services/BackofficeStudioBotService"

export default function BackofficeStudioBotCanalPage() {
  const service = useMemo(() => new BackofficeStudioBotService(), [])

  return (
    <BackofficeStudioBotProvider service={service}>
      <BackofficeStudioBotCanalContainer />
    </BackofficeStudioBotProvider>
  )
}
