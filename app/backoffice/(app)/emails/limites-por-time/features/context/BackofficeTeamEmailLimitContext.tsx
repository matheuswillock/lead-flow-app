"use client"

import { createContext, useContext } from "react"
import { backofficeTeamEmailLimitService } from "../services/BackofficeTeamEmailLimitService"
import { useBackofficeTeamEmailLimitHook } from "./BackofficeTeamEmailLimitHook"
import type { IBackofficeTeamEmailLimitContext } from "./BackofficeTeamEmailLimitTypes"

const BackofficeTeamEmailLimitContext = createContext<IBackofficeTeamEmailLimitContext | null>(null)

export function BackofficeTeamEmailLimitProvider({ children }: { children: React.ReactNode }) {
  const value = useBackofficeTeamEmailLimitHook(backofficeTeamEmailLimitService)
  return (
    <BackofficeTeamEmailLimitContext.Provider value={value}>
      {children}
    </BackofficeTeamEmailLimitContext.Provider>
  )
}

export function useBackofficeTeamEmailLimitContext() {
  const context = useContext(BackofficeTeamEmailLimitContext)
  if (!context) {
    throw new Error("useBackofficeTeamEmailLimitContext must be used within BackofficeTeamEmailLimitProvider")
  }
  return context
}
