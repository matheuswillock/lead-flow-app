"use client"

import { BackofficeOperationalAccessProvider } from "./features/context/BackofficeOperationalAccessContext"
import { BackofficeOperationalAccessContainer } from "./features/container/BackofficeOperationalAccessContainer"

export default function BackofficeOperationalAccessPage() {
  return (
    <BackofficeOperationalAccessProvider>
      <BackofficeOperationalAccessContainer />
    </BackofficeOperationalAccessProvider>
  )
}
