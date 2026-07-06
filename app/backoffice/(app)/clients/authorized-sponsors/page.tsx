"use client"

import { BackofficeAuthorizedSponsorsProvider } from "./features/context/BackofficeAuthorizedSponsorsContext"
import { BackofficeAuthorizedSponsorsContainer } from "./features/container/BackofficeAuthorizedSponsorsContainer"

export default function BackofficeAuthorizedSponsorsPage() {
  return (
    <BackofficeAuthorizedSponsorsProvider>
      <BackofficeAuthorizedSponsorsContainer />
    </BackofficeAuthorizedSponsorsProvider>
  )
}
