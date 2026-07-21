"use client"

import { useContext } from "react"
import { BackofficeLeadQuickEntryContext } from "./BackofficeLeadQuickEntryContext"

export function useBackofficeLeadQuickEntry() {
  const ctx = useContext(BackofficeLeadQuickEntryContext)
  if (!ctx) {
    throw new Error(
      "useBackofficeLeadQuickEntry must be used within BackofficeLeadQuickEntryProvider"
    )
  }
  return ctx
}
