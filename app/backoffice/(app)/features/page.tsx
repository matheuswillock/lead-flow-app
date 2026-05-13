"use client"

import { BackofficeFeatureProvider } from "./features/context/BackofficeFeatureContext"
import { BackofficeFeatureContainer } from "./features/container/BackofficeFeatureContainer"
import { BackofficeFeatureService } from "./features/services/BackofficeFeatureService"

const featureService = new BackofficeFeatureService()

export default function BackofficeFeaturePage() {
  return (
    <BackofficeFeatureProvider featureService={featureService}>
      <BackofficeFeatureContainer />
    </BackofficeFeatureProvider>
  )
}
