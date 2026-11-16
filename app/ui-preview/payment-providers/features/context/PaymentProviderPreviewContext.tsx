"use client"

import { BackofficeUserProvider } from "@/app/backoffice/context/BackofficeUserContext"
import { CardConfigProvider } from "@/app/backoffice/(app)/payment-providers/features/card-config/CardConfigContext"
import { PaymentProviderInstancesContext } from "@/app/backoffice/(app)/payment-providers/features/context/PaymentProviderInstancesContext"
import { createContext, useContext, type ReactNode } from "react"
import { paymentProviderPreviewService } from "../services/PaymentProviderPreviewService"
import { usePaymentProviderPreviewHook } from "./PaymentProviderPreviewHook"
import type { PaymentProviderPreviewContextValue } from "./PaymentProviderPreviewTypes"

const PaymentProviderPreviewContext = createContext<PaymentProviderPreviewContextValue | null>(null)

export function PaymentProviderPreviewProvider({ children }: { children: ReactNode }) {
  const preview = usePaymentProviderPreviewHook(paymentProviderPreviewService)

  return (
    <BackofficeUserProvider>
      <CardConfigProvider cardConfigService={preview.cardConfigService}>
        <PaymentProviderInstancesContext.Provider value={preview.instancesContext}>
          <PaymentProviderPreviewContext.Provider value={preview}>
            {children}
          </PaymentProviderPreviewContext.Provider>
        </PaymentProviderInstancesContext.Provider>
      </CardConfigProvider>
    </BackofficeUserProvider>
  )
}

export function usePaymentProviderPreviewContext() {
  const context = useContext(PaymentProviderPreviewContext)
  if (!context) {
    throw new Error(
      "usePaymentProviderPreviewContext must be used inside PaymentProviderPreviewProvider",
    )
  }
  return context
}
