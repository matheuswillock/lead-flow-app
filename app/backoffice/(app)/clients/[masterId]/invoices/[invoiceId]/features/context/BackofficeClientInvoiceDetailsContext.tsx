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
import type { BackofficeClientInvoiceDetails } from "./BackofficeClientInvoiceDetailsTypes"
import type { IBackofficeClientInvoiceDetailsService } from "../services/IBackofficeClientInvoiceDetailsService"

interface BackofficeClientInvoiceDetailsContextValue {
  invoice: BackofficeClientInvoiceDetails | null
  isLoading: boolean
  error: string | null
  reload: () => Promise<void>
}

const BackofficeClientInvoiceDetailsContext = createContext<
  BackofficeClientInvoiceDetailsContextValue | undefined
>(undefined)

interface BackofficeClientInvoiceDetailsProviderProps {
  children: ReactNode
  masterId: string
  invoiceId: string
  service: IBackofficeClientInvoiceDetailsService
}

export function BackofficeClientInvoiceDetailsProvider({
  children,
  masterId,
  invoiceId,
  service,
}: BackofficeClientInvoiceDetailsProviderProps) {
  const [invoice, setInvoice] = useState<BackofficeClientInvoiceDetails | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false)

  const loadInvoice = useCallback(async () => {
    if (inFlight.current) return

    inFlight.current = true
    setIsLoading(true)
    setError(null)

    try {
      const data = await service.getById(masterId, invoiceId)
      setInvoice(data)
    } catch (err) {
      console.error("[BackofficeClientInvoiceDetailsContext]", err)
      setError("Não foi possível carregar os detalhes da fatura")
      setInvoice(null)
    } finally {
      setIsLoading(false)
      inFlight.current = false
    }
  }, [invoiceId, masterId, service])

  useEffect(() => {
    void loadInvoice()
  }, [loadInvoice])

  return (
    <BackofficeClientInvoiceDetailsContext.Provider
      value={{
        invoice,
        isLoading,
        error,
        reload: loadInvoice,
      }}
    >
      {children}
    </BackofficeClientInvoiceDetailsContext.Provider>
  )
}

export function useBackofficeClientInvoiceDetails() {
  const context = useContext(BackofficeClientInvoiceDetailsContext)
  if (!context) {
    throw new Error(
      "useBackofficeClientInvoiceDetails must be used within BackofficeClientInvoiceDetailsProvider"
    )
  }
  return context
}
