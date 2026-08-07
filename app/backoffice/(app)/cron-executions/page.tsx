"use client"

import { useMemo } from "react"
import { CronExecutionsProvider } from "./features/context/CronExecutionsContext"
import { CronExecutionsContainer } from "./features/container/CronExecutionsContainer"
import { CronExecutionsService } from "./features/services/cronExecutionsService"

export default function CronExecutionsPage() {
  const service = useMemo(() => new CronExecutionsService(), [])

  return (
    <CronExecutionsProvider service={service}>
      <CronExecutionsContainer />
    </CronExecutionsProvider>
  )
}
