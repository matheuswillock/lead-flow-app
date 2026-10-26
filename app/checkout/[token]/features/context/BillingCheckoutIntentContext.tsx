"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { coerceBillingType, normalizeAvailableBillingTypes } from "@/lib/payment-methods/availability-client"
import { BillingCheckoutIntentService } from "../services/BillingCheckoutIntentService"
import type { IBillingCheckoutIntentService } from "../services/IBillingCheckoutIntentService"
import type { BillingType, CheckoutDetails } from "./BillingCheckoutIntentTypes"

type ContextValue = {
  details: CheckoutDetails | null
  availableMethods: BillingType[]
  selectedMethod: BillingType
  setSelectedMethod: (method: BillingType) => void
  loading: boolean
  submitting: boolean
  error: string | null
  submit: () => Promise<string | null>
}

const Context = createContext<ContextValue | null>(null)

export function BillingCheckoutIntentProvider({ token, children }: { token: string; children: ReactNode }) {
  const service = useMemo<IBillingCheckoutIntentService>(() => new BillingCheckoutIntentService(), [])
  const [details, setDetails] = useState<CheckoutDetails | null>(null)
  const [requestedMethod, setSelectedMethod] = useState<BillingType>("PIX")
  const availableMethods = useMemo(
    () => normalizeAvailableBillingTypes(details?.availableBillingTypes),
    [details?.availableBillingTypes]
  )
  const selectedMethod = coerceBillingType(requestedMethod, availableMethods)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setDetails(await service.getDetails(token))
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Link inválido")
    } finally {
      setLoading(false)
    }
  }, [service, token])

  useEffect(() => {
    void load()
  }, [load])

  const submit = useCallback(async () => {
    if (submitting) return null
    setSubmitting(true)
    setError(null)
    try {
      const result = await service.createCheckout(token, selectedMethod)
      return result.checkoutUrl
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível criar o checkout")
      return null
    } finally {
      setSubmitting(false)
    }
  }, [selectedMethod, service, submitting, token])

  return (
    <Context.Provider value={{ details, availableMethods, selectedMethod, setSelectedMethod, loading, submitting, error, submit }}>
      {children}
    </Context.Provider>
  )
}

export function useBillingCheckoutIntent() {
  const value = useContext(Context)
  if (!value) throw new Error("useBillingCheckoutIntent must be used within BillingCheckoutIntentProvider")
  return value
}
