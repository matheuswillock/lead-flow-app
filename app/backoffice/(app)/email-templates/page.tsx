"use client"

import { BackofficeEmailTemplatesProvider } from "./features/context/BackofficeEmailTemplatesContext"
import { BackofficeEmailTemplatesContainer } from "./features/container/BackofficeEmailTemplatesContainer"
import { BackofficeEmailTemplatesService } from "./features/services/BackofficeEmailTemplatesService"

const templatesService = new BackofficeEmailTemplatesService()

export default function BackofficeEmailTemplatesPage() {
  return (
    <BackofficeEmailTemplatesProvider templatesService={templatesService}>
      <BackofficeEmailTemplatesContainer />
    </BackofficeEmailTemplatesProvider>
  )
}
