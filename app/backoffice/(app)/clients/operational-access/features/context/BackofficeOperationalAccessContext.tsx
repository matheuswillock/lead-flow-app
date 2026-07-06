"use client"

import { createContext, useContext, type ReactNode } from "react"
import type { IBackofficeOperationalAccessContext } from "./BackofficeOperationalAccessTypes"
import { useBackofficeOperationalAccessHook } from "./BackofficeOperationalAccessHook"
import {
  backofficeOperationalAccessService,
} from "../services/BackofficeOperationalAccessService"
import type { IBackofficeOperationalAccessService } from "../services/IBackofficeOperationalAccessService"

const BackofficeOperationalAccessContext = createContext<IBackofficeOperationalAccessContext | null>(
  null
)

export function BackofficeOperationalAccessProvider({
  children,
  service = backofficeOperationalAccessService,
}: {
  children: ReactNode
  service?: IBackofficeOperationalAccessService
}) {
  const value = useBackofficeOperationalAccessHook(service)
  return (
    <BackofficeOperationalAccessContext.Provider value={value}>
      {children}
    </BackofficeOperationalAccessContext.Provider>
  )
}

export function useBackofficeOperationalAccessContext() {
  const context = useContext(BackofficeOperationalAccessContext)
  if (!context) {
    throw new Error(
      "useBackofficeOperationalAccessContext must be used within BackofficeOperationalAccessProvider"
    )
  }
  return context
}
