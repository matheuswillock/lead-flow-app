"use client"

import { useMemo } from "react"
import { BackofficeStudioBotProvider } from "../features/context/BackofficeStudioBotContext"
import { BackofficeStudioBotVerificacoesContainer } from "../features/container/BackofficeStudioBotVerificacoesContainer"
import { BackofficeStudioBotService } from "../features/services/BackofficeStudioBotService"

export default function BackofficeStudioBotVerificacoesPage() {
  const service = useMemo(() => new BackofficeStudioBotService(), [])

  return (
    <BackofficeStudioBotProvider service={service}>
      <BackofficeStudioBotVerificacoesContainer />
    </BackofficeStudioBotProvider>
  )
}
