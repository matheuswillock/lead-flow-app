"use client"

import { BackofficeWhatsAppInstancesProvider } from "./features/context/BackofficeWhatsAppInstancesContext"
import { BackofficeWhatsAppInstancesContainer } from "./features/container/BackofficeWhatsAppInstancesContainer"
import { BackofficeWhatsAppInstancesService } from "./features/services/BackofficeWhatsAppInstancesService"

const instancesService = new BackofficeWhatsAppInstancesService()

export default function BackofficeWhatsAppPage() {
  return (
    <BackofficeWhatsAppInstancesProvider instancesService={instancesService}>
      <BackofficeWhatsAppInstancesContainer />
    </BackofficeWhatsAppInstancesProvider>
  )
}
