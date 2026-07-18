"use client"

import { useContext } from "react"
import { BackofficeEmailContatosContext } from "./BackofficeEmailContatosContext"

export function useBackofficeEmailContatos() {
  const ctx = useContext(BackofficeEmailContatosContext)
  if (!ctx) {
    throw new Error("useBackofficeEmailContatos must be used within BackofficeEmailContatosProvider")
  }
  return ctx
}
