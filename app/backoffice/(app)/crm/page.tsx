"use client"

import { useMemo } from "react"
import { BackofficeCrmProvider } from "./features/context/BackofficeCrmContext"
import { BackofficeCrmContainer } from "./features/container/BackofficeCrmContainer"
import { BackofficeCrmService } from "./features/services/BackofficeCrmService"

export default function BackofficeCrmPage() {
  const service = useMemo(() => new BackofficeCrmService(), [])

  return (
    <BackofficeCrmProvider service={service}>
      <BackofficeCrmContainer />
    </BackofficeCrmProvider>
  )
}
