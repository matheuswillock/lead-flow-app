"use client"

import { BackofficeEmailSettingsProvider } from "./features/context/BackofficeEmailSettingsContext"
import { BackofficeEmailSettingsContainer } from "./features/container/BackofficeEmailSettingsContainer"
import { BackofficeEmailSettingsService } from "./features/services/BackofficeEmailSettingsService"

const service = new BackofficeEmailSettingsService()

export default function BackofficeEmailConfiguracoesPage() {
  return (
    <BackofficeEmailSettingsProvider service={service}>
      <BackofficeEmailSettingsContainer />
    </BackofficeEmailSettingsProvider>
  )
}
