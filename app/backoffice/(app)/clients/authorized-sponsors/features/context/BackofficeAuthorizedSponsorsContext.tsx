"use client"

import { createContext, useContext, type ReactNode } from "react"
import type { IBackofficeAuthorizedSponsorsContext } from "./BackofficeAuthorizedSponsorsTypes"
import { useBackofficeAuthorizedSponsorsHook } from "./BackofficeAuthorizedSponsorsHook"
import {
  backofficeAuthorizedSponsorsService,
} from "../services/BackofficeAuthorizedSponsorsService"
import type { IBackofficeAuthorizedSponsorsService } from "../services/IBackofficeAuthorizedSponsorsService"

const BackofficeAuthorizedSponsorsContext = createContext<IBackofficeAuthorizedSponsorsContext | null>(
  null
)

export function BackofficeAuthorizedSponsorsProvider({
  children,
  service = backofficeAuthorizedSponsorsService,
}: {
  children: ReactNode
  service?: IBackofficeAuthorizedSponsorsService
}) {
  const value = useBackofficeAuthorizedSponsorsHook(service)
  return (
    <BackofficeAuthorizedSponsorsContext.Provider value={value}>
      {children}
    </BackofficeAuthorizedSponsorsContext.Provider>
  )
}

export function useBackofficeAuthorizedSponsorsContext() {
  const context = useContext(BackofficeAuthorizedSponsorsContext)
  if (!context) {
    throw new Error(
      "useBackofficeAuthorizedSponsorsContext must be used within BackofficeAuthorizedSponsorsProvider"
    )
  }
  return context
}
