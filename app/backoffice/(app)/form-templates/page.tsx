"use client"

import { BackofficeFormTemplatesProvider } from "./features/context/BackofficeFormTemplatesContext"
import { BackofficeFormTemplatesContainer } from "./features/container/BackofficeFormTemplatesContainer"
import { BackofficeFormTemplatesService } from "./features/services/BackofficeFormTemplatesService"

const service = new BackofficeFormTemplatesService()

export default function BackofficeFormTemplatesPage() {
  return (
    <BackofficeFormTemplatesProvider service={service}>
      <BackofficeFormTemplatesContainer />
    </BackofficeFormTemplatesProvider>
  )
}
