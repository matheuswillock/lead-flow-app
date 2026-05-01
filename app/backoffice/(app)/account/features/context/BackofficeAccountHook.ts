"use client"

import { useContext } from "react"
import { BackofficeAccountContext } from "./BackofficeAccountContext"

export function useBackofficeAccount() {
  const ctx = useContext(BackofficeAccountContext)
  if (!ctx) {
    throw new Error("useBackofficeAccount must be used within BackofficeAccountProvider")
  }
  return ctx
}
