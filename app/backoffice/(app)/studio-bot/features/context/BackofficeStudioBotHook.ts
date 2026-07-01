"use client"

import { useContext } from "react"
import { BackofficeStudioBotContext } from "./BackofficeStudioBotContext"

export function useBackofficeStudioBot() {
  const context = useContext(BackofficeStudioBotContext)
  if (!context) {
    throw new Error("useBackofficeStudioBot must be used within BackofficeStudioBotProvider")
  }
  return context
}
