"use client"

import { useMemo } from "react"
import { BackofficeEmailContatosProvider } from "./features/context/BackofficeEmailContatosContext"
import { BackofficeEmailContatosContainer } from "./features/container/BackofficeEmailContatosContainer"
import { BackofficeEmailContatosService } from "./features/services/BackofficeEmailContatosService"

export default function BackofficeEmailContatosPage() {
  const service = useMemo(() => new BackofficeEmailContatosService(), [])

  return (
    <BackofficeEmailContatosProvider service={service}>
      <BackofficeEmailContatosContainer />
    </BackofficeEmailContatosProvider>
  )
}
