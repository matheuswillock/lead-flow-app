"use client"

import { useCheckoutReturnContext } from "./CheckoutReturnContext"

export function useCheckoutReturn() {
  return useCheckoutReturnContext()
}

