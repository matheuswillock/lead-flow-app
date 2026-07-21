"use client"

import { useContext } from "react"
import { BackofficeWhatsAppInstancesContext } from "./BackofficeWhatsAppInstancesContext"

export function useBackofficeWhatsAppInstances() {
  const context = useContext(BackofficeWhatsAppInstancesContext)
  if (!context) {
    throw new Error(
      "useBackofficeWhatsAppInstances must be used within BackofficeWhatsAppInstancesProvider"
    )
  }
  return context
}
