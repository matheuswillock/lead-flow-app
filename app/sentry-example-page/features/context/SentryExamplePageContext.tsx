"use client"

import { createContext, useContext, useMemo, useState } from "react"
import type { ReactNode } from "react"
import type { SentryExamplePageContextValue } from "./SentryExamplePageTypes"
import { SentryExamplePageService } from "../services/SentryExamplePageService"

const SentryExamplePageContext = createContext<SentryExamplePageContextValue | null>(null)

const sentryExamplePageService = new SentryExamplePageService()

export function SentryExamplePageProvider({ children }: { children: ReactNode }) {
  const [eventId, setEventId] = useState<string | null>(null)
  const [isTriggering, setIsTriggering] = useState(false)
  const errorMessage = "Erro de teste disparado manualmente pela página do Sentry."

  const value = useMemo<SentryExamplePageContextValue>(
    () => ({
      errorMessage,
      eventId,
      isTriggering,
      async triggerExampleError(input) {
        setIsTriggering(true)

        try {
          const nextEventId = await sentryExamplePageService.triggerExampleError(input)
          setEventId(nextEventId)
        } finally {
          setIsTriggering(false)
        }
      },
    }),
    [errorMessage, eventId, isTriggering]
  )

  return (
    <SentryExamplePageContext.Provider value={value}>
      {children}
    </SentryExamplePageContext.Provider>
  )
}

export function useSentryExamplePageContext() {
  const context = useContext(SentryExamplePageContext)

  if (!context) {
    throw new Error("useSentryExamplePageContext deve ser usado dentro do provider.")
  }

  return context
}
