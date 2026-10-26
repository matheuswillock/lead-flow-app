"use client"

import { LandingPagesProvider } from "../context/LandingPagesContext"
import { useLandingPagesHook } from "../context/LandingPagesHook"
import { LandingPagesManagement } from "../components/LandingPagesManagement"

export function LandingPagesContainer() {
  const state = useLandingPagesHook()
  return (
    <LandingPagesProvider value={state}>
      <LandingPagesManagement />
    </LandingPagesProvider>
  )
}
