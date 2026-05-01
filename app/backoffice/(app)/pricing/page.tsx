"use client"

import { BackofficePricingProvider } from "./features/context/BackofficePricingContext"
import { BackofficePricingContainer } from "./features/container/BackofficePricingContainer"
import { BackofficePricingService } from "./features/services/BackofficePricingService"

const pricingService = new BackofficePricingService()

export default function BackofficePricingPage() {
  return (
    <BackofficePricingProvider pricingService={pricingService}>
      <BackofficePricingContainer />
    </BackofficePricingProvider>
  )
}
