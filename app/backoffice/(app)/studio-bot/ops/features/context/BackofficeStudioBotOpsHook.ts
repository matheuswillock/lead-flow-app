"use client"

import { useContext } from "react"
import { BackofficeStudioBotOpsContext } from "./BackofficeStudioBotOpsContext"

export function useBackofficeStudioBotOps() {
  const context = useContext(BackofficeStudioBotOpsContext)
  if (!context) {
    throw new Error("useBackofficeStudioBotOps must be used within BackofficeStudioBotOpsProvider")
  }
  return context
}
