"use client"

import { createContext, useContext } from "react"
import type { ReactNode } from "react"
import { useEmailSettings, type EmailSettingsHookReturn } from "./EmailSettingsHook"

const EmailSettingsContext = createContext<EmailSettingsHookReturn | undefined>(undefined)

export function EmailSettingsProvider({ children }: { children: ReactNode }) {
  const value = useEmailSettings()
  return <EmailSettingsContext.Provider value={value}>{children}</EmailSettingsContext.Provider>
}

export function useEmailSettingsContext(): EmailSettingsHookReturn {
  const ctx = useContext(EmailSettingsContext)
  if (!ctx) throw new Error("useEmailSettingsContext must be used within EmailSettingsProvider")
  return ctx
}
