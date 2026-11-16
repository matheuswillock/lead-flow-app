"use client"

import { createContext, useCallback, useEffect, useRef, useState } from "react"
import type { ReactNode } from "react"
import { paymentProviderInstancesService } from "../services/PaymentProviderInstancesService"
import type {
  CreatePaymentProviderInstance,
  PaymentProviderInstance,
} from "../services/IPaymentProviderInstancesService"
import type { PaymentProviderInstancesContextValue } from "./PaymentProviderInstancesTypes"

export const PaymentProviderInstancesContext = createContext<PaymentProviderInstancesContextValue | null>(null)

export function PaymentProviderInstancesProvider({ children }: { children: ReactNode }) {
  const [instances, setInstances] = useState<PaymentProviderInstance[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false)
  const loaded = useRef(false)

  const refresh = useCallback(async () => {
    if (inFlight.current || loaded.current) return
    inFlight.current = true
    try {
      setError(null)
      setInstances(await paymentProviderInstancesService.list())
      loaded.current = true
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar providers")
    } finally {
      setLoading(false)
      inFlight.current = false
    }
  }, [])

  const create = useCallback(async (input: CreatePaymentProviderInstance) => {
    setSaving(true)
    try {
      await paymentProviderInstancesService.create(input)
      loaded.current = false
      await refresh()
    } finally {
      setSaving(false)
    }
  }, [refresh])

  const update = useCallback(async (input: {
    id: string
    isDefault?: boolean
    credentials?: Record<string, string>
    displayName?: string
    logoUrl?: string | null
    logoAltText?: string | null
  }) => {
    setSaving(true)
    try {
      await paymentProviderInstancesService.update(input)
      loaded.current = false
      await refresh()
    } finally {
      setSaving(false)
    }
  }, [refresh])

  const checkHealth = useCallback(async (
    provider: PaymentProviderInstance["provider"],
    environment: PaymentProviderInstance["environment"],
  ) => {
    setSaving(true)
    try {
      await paymentProviderInstancesService.checkHealth(provider, environment)
      loaded.current = false
      await refresh()
    } finally {
      setSaving(false)
    }
  }, [refresh])

  useEffect(() => { void refresh() }, [refresh])

  return <PaymentProviderInstancesContext.Provider value={{ instances, loading, saving, error, refresh, create, update, checkHealth }}>{children}</PaymentProviderInstancesContext.Provider>
}
