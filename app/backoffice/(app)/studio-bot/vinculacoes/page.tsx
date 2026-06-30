"use client"

import { useMemo } from "react"
import { BackofficeStudioBotProvider } from "../features/context/BackofficeStudioBotContext"
import { BackofficeStudioBotVinculacoesContainer } from "../features/container/BackofficeStudioBotVinculacoesContainer"
import { BackofficeStudioBotService } from "../features/services/BackofficeStudioBotService"

export default function BackofficeStudioBotVinculacoesPage() {
  const service = useMemo(() => new BackofficeStudioBotService(), [])

  return (
    <BackofficeStudioBotProvider service={service}>
      <BackofficeStudioBotVinculacoesContainer />
    </BackofficeStudioBotProvider>
  )
}
