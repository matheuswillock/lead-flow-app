"use client"

import { BackofficeAdhesionsProvider } from "./features/context/BackofficeAdhesionsContext"
import { BackofficeAdhesionsContainer } from "./features/container/BackofficeAdhesionsContainer"
import { BackofficeAdhesionsService } from "./features/services/BackofficeAdhesionsService"

const service = new BackofficeAdhesionsService()

export default function BackofficeClientAdhesionsPage() {
  return (
    <BackofficeAdhesionsProvider service={service}>
      <BackofficeAdhesionsContainer />
    </BackofficeAdhesionsProvider>
  )
}
