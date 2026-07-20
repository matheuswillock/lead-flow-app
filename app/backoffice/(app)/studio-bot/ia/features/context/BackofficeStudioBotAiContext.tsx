"use client"

import { createContext, useContext, type ReactNode } from "react"
import type { IBackofficeStudioBotAiService } from "../services/IBackofficeStudioBotAiService"

const BackofficeStudioBotAiContext = createContext<IBackofficeStudioBotAiService | null>(null)

export function BackofficeStudioBotAiProvider({
  service,
  children,
}: {
  service: IBackofficeStudioBotAiService
  children: ReactNode
}) {
  return (
    <BackofficeStudioBotAiContext.Provider value={service}>
      {children}
    </BackofficeStudioBotAiContext.Provider>
  )
}

export function useBackofficeStudioBotAiService() {
  const ctx = useContext(BackofficeStudioBotAiContext)
  if (!ctx) {
    throw new Error("useBackofficeStudioBotAiService deve ser usado dentro do Provider")
  }
  return ctx
}
