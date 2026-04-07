"use client"

import { BackofficeClientsProvider } from "./features/context/BackofficeClientsContext"
import { BackofficeClientsContainer } from "./features/container/BackofficeClientsContainer"
import { BackofficeClientsService } from "./features/services/BackofficeClientsService"

const clientsService = new BackofficeClientsService()

export default function BackofficeClientsPage() {
  return (
    <BackofficeClientsProvider clientsService={clientsService}>
      <BackofficeClientsContainer />
    </BackofficeClientsProvider>
  )
}
