"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"
import type { ReactNode } from "react"
import type {
  IBackofficePaymentsService,
  BackofficePaymentItem,
  CreatePaymentFormData,
} from "../services/IBackofficePaymentsService"
import type { BackofficeClientItem } from "../services/IBackofficePaymentsService"

interface PaymentsContextValue {
  payments: BackofficePaymentItem[]
  clients: BackofficeClientItem[]
  isLoading: boolean
  isCreating: boolean
  error: string | null
  fetchPayments: () => Promise<void>
  createPayment: (
    data: CreatePaymentFormData
  ) => Promise<{ isValid: boolean; errorMessages: string[]; result?: BackofficePaymentItem }>
}

const BackofficePaymentsContext = createContext<PaymentsContextValue | undefined>(undefined)

interface Props {
  children: ReactNode
  paymentsService: IBackofficePaymentsService
}

export function BackofficePaymentsProvider({ children, paymentsService }: Props) {
  const [payments, setPayments] = useState<BackofficePaymentItem[]>([])
  const [clients, setClients] = useState<BackofficeClientItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false)

  const fetchPayments = useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true
    setIsLoading(true)
    setError(null)
    try {
      const [paymentsData, clientsData] = await Promise.all([
        paymentsService.list(),
        paymentsService.listClients(),
      ])
      setPayments(paymentsData)
      setClients(clientsData)
    } catch (err) {
      console.error("[BackofficePaymentsContext]", err)
      setError("Erro ao carregar cobranças")
    } finally {
      setIsLoading(false)
      inFlight.current = false
    }
  }, [paymentsService])

  useEffect(() => {
    fetchPayments()
  }, [fetchPayments])

  const createPayment = useCallback(
    async (data: CreatePaymentFormData) => {
      setIsCreating(true)
      try {
        const result = await paymentsService.create(data)
        if (result.isValid) {
          await fetchPayments()
        }
        return result
      } finally {
        setIsCreating(false)
      }
    },
    [paymentsService, fetchPayments]
  )

  return (
    <BackofficePaymentsContext.Provider
      value={{ payments, clients, isLoading, isCreating, error, fetchPayments, createPayment }}
    >
      {children}
    </BackofficePaymentsContext.Provider>
  )
}

export function useBackofficePayments(): PaymentsContextValue {
  const ctx = useContext(BackofficePaymentsContext)
  if (!ctx) throw new Error("useBackofficePayments must be used within BackofficePaymentsProvider")
  return ctx
}
