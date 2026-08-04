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
  isSendingNotification: boolean
  isUpdatingInvoice: boolean
  isDeletingInvoice: boolean
  error: string | null
  reload: () => Promise<void>
  sendStatusNotification: () => Promise<string>
  updateInvoice: (data: { value: number; dueDate: string }) => Promise<void>
  deleteInvoice: () => Promise<string>
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
  const [isSendingNotification, setIsSendingNotification] = useState(false)
  const [isUpdatingInvoice, setIsUpdatingInvoice] = useState(false)
  const [isDeletingInvoice, setIsDeletingInvoice] = useState(false)
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

  const sendStatusNotification = useCallback(async () => {
    if (isSendingNotification) {
      return "Envio de notificação já em andamento"
    }

    setIsSendingNotification(true)

    try {
      const result = await service.notifyStatusEmail(masterId, invoiceId)
      return result.message
    } finally {
      setIsSendingNotification(false)
    }
  }, [invoiceId, isSendingNotification, masterId, service])

  const updateInvoice = useCallback(
    async (data: { value: number; dueDate: string }) => {
      if (isUpdatingInvoice) return

      setIsUpdatingInvoice(true)
      try {
        const updated = await service.updateInvoice(masterId, invoiceId, data)
        setInvoice(updated)
      } finally {
        setIsUpdatingInvoice(false)
      }
    },
    [invoiceId, isUpdatingInvoice, masterId, service]
  )

  const deleteInvoice = useCallback(async () => {
    if (isDeletingInvoice) {
      return "Remoção de cobrança já em andamento"
    }

    setIsDeletingInvoice(true)
    try {
      const result = await service.deleteInvoice(masterId, invoiceId)
      return result.message
    } finally {
      setIsDeletingInvoice(false)
    }
  }, [invoiceId, isDeletingInvoice, masterId, service])

  return (
    <BackofficeClientInvoiceDetailsContext.Provider
      value={{
        invoice,
        isLoading,
        isSendingNotification,
        isUpdatingInvoice,
        isDeletingInvoice,
        error,
        reload: loadInvoice,
        sendStatusNotification,
        updateInvoice,
        deleteInvoice,
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
