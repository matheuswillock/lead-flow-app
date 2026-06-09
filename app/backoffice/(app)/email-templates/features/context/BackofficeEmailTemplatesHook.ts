"use client"

import { useContext } from "react"
import { BackofficeEmailTemplatesContext } from "./BackofficeEmailTemplatesContext"

export function useBackofficeEmailTemplates() {
  const ctx = useContext(BackofficeEmailTemplatesContext)
  if (!ctx) throw new Error("useBackofficeEmailTemplates must be used within BackofficeEmailTemplatesProvider")
  return ctx
}
