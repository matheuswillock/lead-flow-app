"use client"

import { BackofficePaymentProvidersProvider } from "./features/context/BackofficePaymentProvidersContext"
import { BackofficePaymentProvidersContainer } from "./features/container/BackofficePaymentProvidersContainer"
import { BackofficePaymentProvidersService } from "./features/services/BackofficePaymentProvidersService"

const paymentProvidersService = new BackofficePaymentProvidersService()

export default function BackofficePaymentProvidersPage() {
  return (
    <BackofficePaymentProvidersProvider service={paymentProvidersService}>
      <BackofficePaymentProvidersContainer />
    </BackofficePaymentProvidersProvider>
  )
}
