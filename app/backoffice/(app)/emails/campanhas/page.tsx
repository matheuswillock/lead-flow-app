"use client"

import { useMemo } from "react"
import { BackofficeEmailCampaignsProvider } from "./features/context/BackofficeEmailCampaignsContext"
import { BackofficeEmailCampaignsContainer } from "./features/container/BackofficeEmailCampaignsContainer"
import { BackofficeEmailCampaignsService } from "./features/services/BackofficeEmailCampaignsService"

export default function BackofficeEmailCampanhasPage() {
  const service = useMemo(() => new BackofficeEmailCampaignsService(), [])

  return (
    <BackofficeEmailCampaignsProvider service={service}>
      <BackofficeEmailCampaignsContainer />
    </BackofficeEmailCampaignsProvider>
  )
}
