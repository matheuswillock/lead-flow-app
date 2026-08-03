"use client"

import { BackofficeTeamEmailLimitProvider } from "./features/context/BackofficeTeamEmailLimitContext"
import { BackofficeTeamEmailLimitContainer } from "./features/container/BackofficeTeamEmailLimitContainer"

export default function BackofficeTeamEmailLimitPage() {
  return (
    <BackofficeTeamEmailLimitProvider>
      <BackofficeTeamEmailLimitContainer />
    </BackofficeTeamEmailLimitProvider>
  )
}
