"use client"

import { useMemo } from "react"
import { BackofficeAccountProvider } from "./features/context/BackofficeAccountContext"
import { BackofficeAccountService } from "./features/services/BackofficeAccountService"
import { BackofficeAccountContainer } from "./features/container/BackofficeAccountContainer"

export default function BackofficeAccountPage() {
  const service = useMemo(() => new BackofficeAccountService(), [])

  return (
    <BackofficeAccountProvider service={service}>
      <BackofficeAccountContainer />
    </BackofficeAccountProvider>
  )
}
