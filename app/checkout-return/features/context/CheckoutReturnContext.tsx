"use client"

import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react"
import { useRouter } from "next/navigation"

import type { CheckoutReturnState } from "./CheckoutReturnTypes"

interface CheckoutReturnContextValue {
  state: CheckoutReturnState
}

const CheckoutReturnContext = createContext<CheckoutReturnContextValue | null>(null)

export function CheckoutReturnProvider({ children }: { children: ReactNode }) {
  const router = useRouter()

  useEffect(() => {
    const timeout = setTimeout(() => {
      router.replace("/sign-in")
    }, 1500)

    return () => clearTimeout(timeout)
  }, [router])

  const value = useMemo<CheckoutReturnContextValue>(() => ({ state: { status: "redirecting" } }), [])

  return <CheckoutReturnContext.Provider value={value}>{children}</CheckoutReturnContext.Provider>
}

export function useCheckoutReturnContext(): CheckoutReturnContextValue {
  const context = useContext(CheckoutReturnContext)
  if (!context) {
    throw new Error("useCheckoutReturnContext must be used within CheckoutReturnProvider")
  }
  return context
}

