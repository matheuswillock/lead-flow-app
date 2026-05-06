"use client"

import { CheckoutReturnProvider } from "./features/context/CheckoutReturnContext"
import { CheckoutReturnContainer } from "./features/container/CheckoutReturnContainer"

export default function CheckoutReturnPage() {
  return (
    <CheckoutReturnProvider>
      <CheckoutReturnContainer />
    </CheckoutReturnProvider>
  )
}
