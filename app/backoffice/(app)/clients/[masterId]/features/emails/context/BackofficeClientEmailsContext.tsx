"use client"

import { createContext, useContext, type ReactNode } from "react"
import {
  useBackofficeClientEmailsHook,
  type UseBackofficeClientEmailsHookProps,
} from "./BackofficeClientEmailsHook"
import type { BackofficeClientEmailsContextValue } from "./BackofficeClientEmailsTypes"

const BackofficeClientEmailsContext = createContext<
  BackofficeClientEmailsContextValue | undefined
>(undefined)

interface BackofficeClientEmailsProviderProps extends UseBackofficeClientEmailsHookProps {
  children: ReactNode
}

export function BackofficeClientEmailsProvider({
  children,
  ...hookProps
}: BackofficeClientEmailsProviderProps) {
  const value = useBackofficeClientEmailsHook(hookProps)

  return (
    <BackofficeClientEmailsContext.Provider value={value}>
      {children}
    </BackofficeClientEmailsContext.Provider>
  )
}

export function useBackofficeClientEmailsContext(): BackofficeClientEmailsContextValue {
  const context = useContext(BackofficeClientEmailsContext)
  if (!context) {
    throw new Error(
      "useBackofficeClientEmailsContext must be used within BackofficeClientEmailsProvider"
    )
  }
  return context
}
