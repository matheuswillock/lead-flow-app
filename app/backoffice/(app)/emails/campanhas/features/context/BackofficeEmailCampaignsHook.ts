"use client"

import { useContext } from "react"
import { BackofficeEmailCampaignsContext } from "./BackofficeEmailCampaignsContext"

export function useBackofficeEmailCampaigns() {
  const ctx = useContext(BackofficeEmailCampaignsContext)
  if (!ctx) {
    throw new Error(
      "useBackofficeEmailCampaigns must be used within BackofficeEmailCampaignsProvider"
    )
  }
  return ctx
}
