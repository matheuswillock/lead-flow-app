"use client"

import { useMemo } from "react"
import { BackofficeIntegrationsProvider } from "./features/context/BackofficeIntegrationsContext"
import { BackofficeIntegrationsContainer } from "./features/container/BackofficeIntegrationsContainer"
import { BackofficeIntegrationsService } from "./features/services/BackofficeIntegrationsService"

export default function BackofficeIntegracoesPage() {
  const service = useMemo(() => new BackofficeIntegrationsService(), [])

  return (
    <BackofficeIntegrationsProvider service={service}>
      <BackofficeIntegrationsContainer />
    </BackofficeIntegrationsProvider>
  )
}
