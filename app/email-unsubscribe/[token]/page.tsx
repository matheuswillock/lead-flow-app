"use client"

import { EmailUnsubscribeContainer } from "./features/container/EmailUnsubscribeContainer"
import { EmailUnsubscribeProvider } from "./features/context/EmailUnsubscribeContext"

export default function EmailUnsubscribePage() {
  return (
    <EmailUnsubscribeProvider>
      <EmailUnsubscribeContainer />
    </EmailUnsubscribeProvider>
  )
}
