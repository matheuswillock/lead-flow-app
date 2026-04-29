"use client"

import { useContext } from "react"
import { BackofficeIntegrationsContext } from "./BackofficeIntegrationsContext"

export function useBackofficeIntegrations() {
  const ctx = useContext(BackofficeIntegrationsContext)
  if (!ctx) {
    throw new Error(
      "useBackofficeIntegrations must be used within BackofficeIntegrationsProvider"
    )
  }
  return ctx
}
