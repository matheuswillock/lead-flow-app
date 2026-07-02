"use client"

import { BackofficeContractsProvider } from "./features/context/BackofficeContractsContext"
import { BackofficeContractsContainer } from "./features/container/BackofficeContractsContainer"
import { BackofficeContractsService } from "./features/services/BackofficeContractsService"

const service = new BackofficeContractsService()

export default function BackofficeContractsPage() {
  return (
    <BackofficeContractsProvider service={service}>
      <BackofficeContractsContainer />
    </BackofficeContractsProvider>
  )
}
