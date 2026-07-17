"use client"

import { BackofficeEmailUnsubscribeContainer } from "./features/container/BackofficeEmailUnsubscribeContainer"
import { BackofficeEmailUnsubscribeProvider } from "./features/context/BackofficeEmailUnsubscribeContext"

export default function BackofficeEmailUnsubscribePage() {
  return (
    <BackofficeEmailUnsubscribeProvider>
      <BackofficeEmailUnsubscribeContainer />
    </BackofficeEmailUnsubscribeProvider>
  )
}
