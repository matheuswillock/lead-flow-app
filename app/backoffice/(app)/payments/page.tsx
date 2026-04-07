"use client"

import { BackofficePaymentsProvider } from "./features/context/BackofficePaymentsContext"
import { BackofficePaymentsContainer } from "./features/container/BackofficePaymentsContainer"
import { BackofficePaymentsService } from "./features/services/BackofficePaymentsService"

const paymentsService = new BackofficePaymentsService()

export default function BackofficePaymentsPage() {
  return (
    <BackofficePaymentsProvider paymentsService={paymentsService}>
      <BackofficePaymentsContainer />
    </BackofficePaymentsProvider>
  )
}
