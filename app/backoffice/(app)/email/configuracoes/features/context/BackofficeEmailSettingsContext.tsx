"use client"

import { createContext, useContext } from "react"
import type { ReactNode } from "react"
import type { IBackofficeEmailSettingsService } from "../services/IBackofficeEmailSettingsService"
import { useBackofficeEmailSettingsState, type BackofficeEmailSettingsHookReturn } from "./BackofficeEmailSettingsHook"

const BackofficeEmailSettingsContext = createContext<BackofficeEmailSettingsHookReturn | undefined>(undefined)

export function BackofficeEmailSettingsProvider({
  children,
  service,
}: {
  children: ReactNode
  service: IBackofficeEmailSettingsService
}) {
  const value = useBackofficeEmailSettingsState(service)
  return (
    <BackofficeEmailSettingsContext.Provider value={value}>
      {children}
    </BackofficeEmailSettingsContext.Provider>
  )
}

export function useBackofficeEmailSettings(): BackofficeEmailSettingsHookReturn {
  const ctx = useContext(BackofficeEmailSettingsContext)
  if (!ctx) throw new Error("useBackofficeEmailSettings must be used within BackofficeEmailSettingsProvider")
  return ctx
}
