"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import type { IPublicAdhesionService } from "../services/IPublicAdhesionService"
import { PublicAdhesionService } from "../services/PublicAdhesionService"
import type {
  PublicAdhesionCheckoutInput,
  PublicAdhesionDetails,
  PublicAdhesionPayment,
} from "./PublicAdhesionTypes"
import { toUserToastMessage } from "@/lib/ui/to-user-toast-message"

interface PublicAdhesionContextValue {
  token: string
  details: PublicAdhesionDetails | null
  payment: PublicAdhesionPayment | null
  isLoading: boolean
  isSubmitting: boolean
  error: string | null
  submitCheckout: (input: PublicAdhesionCheckoutInput) => Promise<void>
  refreshPaymentStatus: (options?: { sync?: boolean }) => Promise<void>
}

const PublicAdhesionContext = createContext<PublicAdhesionContextValue | null>(null)

export function PublicAdhesionProvider({
  children,
  token,
}: {
  children: ReactNode
  token: string
}) {
  const service = useMemo<IPublicAdhesionService>(() => new PublicAdhesionService(), [])
  const [details, setDetails] = useState<PublicAdhesionDetails | null>(null)
  const [payment, setPayment] = useState<PublicAdhesionPayment | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inFlightKey = useRef<string | null>(null)
  const paymentRefreshInFlightKey = useRef<string | null>(null)
  const lastSuccessKey = useRef<string | null>(null)

  const loadDetails = useCallback(async () => {
    const requestKey = `details:${token}`
    if (inFlightKey.current === requestKey || lastSuccessKey.current === requestKey) return

    inFlightKey.current = requestKey
    setIsLoading(true)
    setError(null)
    try {
      const response = await service.getDetails(token)
      setDetails(response)
      lastSuccessKey.current = requestKey
    } catch (err) {
      console.error("[PublicAdhesionContext][loadDetails]", err)
      setError(toUserToastMessage(err))
    } finally {
      setIsLoading(false)
      inFlightKey.current = null
    }
  }, [service, token])

  const submitCheckout = useCallback(
    async (input: PublicAdhesionCheckoutInput) => {
      if (isSubmitting) return
      setIsSubmitting(true)
      try {
        const response = await service.createCheckout(token, input)
        setPayment(response)
      } catch (err) {
        console.error("[PublicAdhesionContext][submitCheckout]", err)
        throw new Error(toUserToastMessage(err))
      } finally {
        setIsSubmitting(false)
      }
    },
    [isSubmitting, service, token]
  )

  const refreshPaymentStatus = useCallback(
    async (options?: { sync?: boolean }) => {
      const requestKey = `payment:${token}:${options?.sync ? "sync" : "poll"}`
      if (paymentRefreshInFlightKey.current) return

      paymentRefreshInFlightKey.current = requestKey
      try {
        const response = await service.getPaymentStatus(token, options)
        setPayment(response)
      } catch (err) {
        console.error("[PublicAdhesionContext][refreshPaymentStatus]", err)
        throw new Error(toUserToastMessage(err))
      } finally {
        paymentRefreshInFlightKey.current = null
      }
    },
    [service, token]
  )

  useEffect(() => {
    void loadDetails()
  }, [loadDetails])

  return (
    <PublicAdhesionContext.Provider
      value={{
        token,
        details,
        payment,
        isLoading,
        isSubmitting,
        error,
        submitCheckout,
        refreshPaymentStatus,
      }}
    >
      {children}
    </PublicAdhesionContext.Provider>
  )
}

export function usePublicAdhesionContext(): PublicAdhesionContextValue {
  const context = useContext(PublicAdhesionContext)
  if (!context) {
    throw new Error("usePublicAdhesionContext must be used within PublicAdhesionProvider")
  }
  return context
}
