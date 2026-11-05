"use client"

import { BackofficePaymentsProvider } from "./features/context/BackofficePaymentsContext"
import { BackofficePaymentsContainer } from "./features/container/BackofficePaymentsContainer"
import { BackofficePaymentsService } from "./features/services/BackofficePaymentsService"
import { CardConfigProvider } from "./features/card-config/CardConfigContext"
import { CardConfigService } from "./features/card-config/CardConfigService"

const paymentsService = new BackofficePaymentsService()
const cardConfigService = new CardConfigService()

export default function BackofficePaymentsPage() {
  return (
    <BackofficePaymentsProvider paymentsService={paymentsService}>
      <CardConfigProvider cardConfigService={cardConfigService}>
        <BackofficePaymentsContainer />
      </CardConfigProvider>
    </BackofficePaymentsProvider>
  )
}
