"use client"

import { useContext } from "react"
import { BackofficeCrmContext } from "./BackofficeCrmContext"

export function useBackofficeCrm() {
  const ctx = useContext(BackofficeCrmContext)
  if (!ctx) {
    throw new Error("useBackofficeCrm must be used within BackofficeCrmProvider")
  }
  return ctx
}
