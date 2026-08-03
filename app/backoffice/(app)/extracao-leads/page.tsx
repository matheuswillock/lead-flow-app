"use client"

import { BackofficeLeadExtractionProvider } from "./features/context/BackofficeLeadExtractionContext"
import { BackofficeLeadExtractionContainer } from "./features/container/BackofficeLeadExtractionContainer"
import { BackofficeLeadExtractionService } from "./features/services/BackofficeLeadExtractionService"

const service = new BackofficeLeadExtractionService()

export default function ExtracaoLeadsPage() {
  return (
    <BackofficeLeadExtractionProvider service={service}>
      <BackofficeLeadExtractionContainer />
    </BackofficeLeadExtractionProvider>
  )
}
